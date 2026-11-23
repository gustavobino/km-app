import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Applies the real migrations on top of a Supabase shim in PGlite and checks
 * that Row Level Security isolates users. Each test runs inside a transaction
 * that is rolled back.
 */

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const ALICE_DAY = "10000000-0000-4000-8000-00000000000a";
const BOB_DAY = "10000000-0000-4000-8000-00000000000b";

let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`savepoint as_user;`);
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [
    user ? JSON.stringify({ sub: user, role: "authenticated" }) : "",
  ]);
  await db.exec(
    user ? `set local role authenticated;` : `set local role anon;`,
  );
  try {
    const result = await db.query<Record<string, unknown>>(sql, params);
    await db.exec(`reset role; release savepoint as_user;`);
    return result;
  } catch (error) {
    // An error aborts the transaction; roll back to the savepoint, which also restores the role.
    await db.exec(
      `rollback to savepoint as_user; release savepoint as_user; reset role;`,
    );
    throw error;
  }
}

async function count(user: string | null, table: string) {
  const r = await as(user, `select count(*)::int as n from public.${table}`);
  return r.rows[0]!.n as number;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(read("db/test-utils/supabase-shim.sql"));
  await db.exec(read("db/migrations/0001_init.sql"));
  await db.exec(read("db/seed.sql"));
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("rollback; begin;").catch(() => db.exec("begin;"));
  await db.exec(`
    insert into auth.users (id, email) values ('${ALICE}', 'a@example.com'), ('${BOB}', 'b@example.com');
    insert into public.days (id, user_id, date, minutes, km) values
      ('${ALICE_DAY}', '${ALICE}', '2026-11-23', 510, 142),
      ('${BOB_DAY}', '${BOB}', '2026-11-23', 300, 90);
    insert into public.earnings (user_id, day_id, source, amount_cents) values
      ('${ALICE}', '${ALICE_DAY}', 'uber', 21250),
      ('${BOB}', '${BOB_DAY}', '99', 5000);
    insert into public.payments (user_id, provider, provider_payment_id, status, amount_cents)
      values ('${BOB}', 'mercadopago', 'mp-1', 'approved', 1790);
    insert into public.entitlements (user_id, plan, source) values ('${BOB}', 'premium', 'purchase');
  `);
});

describe("schema", () => {
  it("creates a profile for every new auth user", async () => {
    const r = await db.query<{ id: string }>(
      `select id from public.profiles order by id`,
    );
    expect(r.rows.map((x) => x.id)).toEqual([ALICE, BOB]);
  });

  it("enables RLS on every public table", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`);
    expect(r.rows.length).toBeGreaterThanOrEqual(10);
    for (const row of r.rows)
      expect(row.relrowsecurity, row.relname).toBe(true);
  });

  it("seeds cost_reference flagged as placeholders", async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from public.cost_reference where is_placeholder`,
    );
    expect(r.rows[0]!.n).toBe(12);
  });

  it("allows only one day per user and date", async () => {
    await expect(
      db.exec(
        `insert into public.days (user_id, date) values ('${ALICE}', '2026-11-23')`,
      ),
    ).rejects.toThrow();
  });

  it("rejects negative money", async () => {
    await expect(
      db.exec(
        `insert into public.earnings (user_id, day_id, source, amount_cents) values ('${ALICE}', '${ALICE_DAY}', 'uber', -1)`,
      ),
    ).rejects.toThrow();
  });
});

describe("RLS isolation", () => {
  it("each user sees only their own rows", async () => {
    expect(await count(ALICE, "days")).toBe(1);
    expect(await count(ALICE, "earnings")).toBe(1);
    expect(await count(ALICE, "profiles")).toBe(1);
    expect(await count(BOB, "days")).toBe(1);
    const r = await as(ALICE, `select amount_cents from public.earnings`);
    expect(r.rows).toEqual([{ amount_cents: 21250 }]);
  });

  it("anonymous users see nothing and cannot read reference data", async () => {
    await expect(as(null, `select * from public.days`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      as(null, `select * from public.cost_reference`),
    ).rejects.toThrow(/permission denied/);
  });

  it("signed-in users can read reference data but not change it", async () => {
    expect(await count(ALICE, "cost_reference")).toBe(12);
    await expect(
      as(ALICE, `update public.cost_reference set tires_cents_per_km = 0`),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot insert rows owned by someone else", async () => {
    await expect(
      as(
        ALICE,
        `insert into public.days (user_id, date) values ($1, '2026-11-24')`,
        [BOB],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("defaults user_id to the caller", async () => {
    const r = await as(
      ALICE,
      `insert into public.days (date) values ('2026-11-24') returning user_id`,
    );
    expect(r.rows[0]!.user_id).toBe(ALICE);
  });

  it("cannot attach an earning to another user's day", async () => {
    await expect(
      as(
        ALICE,
        `insert into public.earnings (day_id, source, amount_cents) values ($1, 'uber', 100)`,
        [BOB_DAY],
      ),
    ).rejects.toThrow();
  });

  it("cannot update or delete another user's rows", async () => {
    const upd = await as(
      ALICE,
      `update public.days set km = 1 where id = $1 returning id`,
      [BOB_DAY],
    );
    expect(upd.rows).toHaveLength(0);
    const del = await as(
      ALICE,
      `delete from public.earnings where user_id = $1 returning id`,
      [BOB],
    );
    expect(del.rows).toHaveLength(0);
    const bob = await db.query<{ km: number }>(
      `select km from public.days where id = $1`,
      [BOB_DAY],
    );
    expect(bob.rows[0]!.km).toBe(90);
  });

  it("cannot move own row to another user", async () => {
    await expect(
      as(ALICE, `update public.days set user_id = $1 where id = $2`, [
        BOB,
        ALICE_DAY,
      ]),
    ).rejects.toThrow(/row-level security/);
  });

  it("payments and entitlements are read-only and private", async () => {
    expect(await count(ALICE, "payments")).toBe(0);
    expect(await count(ALICE, "entitlements")).toBe(0);
    expect(await count(BOB, "payments")).toBe(1);
    expect(await count(BOB, "entitlements")).toBe(1);
    await expect(
      as(
        ALICE,
        `insert into public.entitlements (user_id, plan, source) values ($1, 'premium', 'manual')`,
        [ALICE],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(BOB, `update public.payments set status = 'refunded'`),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot insert a profile for someone else", async () => {
    await expect(
      as(ALICE, `insert into public.profiles (id) values (gen_random_uuid())`),
    ).rejects.toThrow(/permission denied/);
  });

  it("cascades user deletion to all their data", async () => {
    await db.exec(`delete from auth.users where id = '${ALICE}'`);
    const r = await db.query<{ n: number }>(`
      select (select count(*) from public.days where user_id = '${ALICE}')
           + (select count(*) from public.earnings where user_id = '${ALICE}')
           + (select count(*) from public.profiles where id = '${ALICE}') as n`);
    expect(Number(r.rows[0]!.n)).toBe(0);
  });
});
