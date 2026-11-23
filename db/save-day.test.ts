import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, runAs } from "./test-utils/pglite";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const DAY_ID = "20000000-0000-4000-8000-000000000001";
const OTHER_ID = "20000000-0000-4000-8000-000000000002";
const E1 = "30000000-0000-4000-8000-000000000001";
const E2 = "30000000-0000-4000-8000-000000000002";
const X1 = "40000000-0000-4000-8000-000000000001";

let db: PGlite;

function payload(over: Record<string, unknown> = {}) {
  return {
    id: DAY_ID,
    date: "2026-11-23",
    minutes: 510,
    km: 142,
    is_day_off: false,
    shifts: ["evening", "night"],
    note: null,
    client_updated_at: "2026-11-23T23:00:00Z",
    earnings: [
      {
        id: E1,
        source: "uber",
        label: null,
        amount_cents: 21250,
        minutes: null,
      },
      {
        id: E2,
        source: "other",
        label: "inDrive",
        amount_cents: 4000,
        minutes: null,
      },
    ],
    expenses: [
      {
        id: X1,
        category: "fuel",
        label: null,
        amount_cents: 8500,
        liters: 14.2,
        odometer_km: 52340,
        full_tank: true,
      },
    ],
    ...over,
  };
}

async function save(user: string, p: Record<string, unknown>) {
  const r = await runAs(db, user, `select public.save_day($1::jsonb) as r`, [
    JSON.stringify(p),
  ]);
  return r.rows[0]!.r as {
    id: string;
    applied: boolean;
    client_updated_at: string;
  };
}

async function dayRow(user: string) {
  const r = await db.query<Record<string, unknown>>(
    `select d.id, d.minutes, d.km, d.shifts, d.is_day_off,
            (select coalesce(sum(amount_cents),0)::int from public.earnings where day_id = d.id) as gross,
            (select count(*)::int from public.earnings where day_id = d.id) as n_earn,
            (select coalesce(sum(amount_cents),0)::int from public.expenses where day_id = d.id) as spent
     from public.days d where d.user_id = $1 and d.date = '2026-11-23'`,
    [user],
  );
  return r.rows[0];
}

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("rollback; begin;").catch(() => db.exec("begin;"));
  await db.exec(
    `insert into auth.users (id, email) values ('${ALICE}', 'a@example.com'), ('${BOB}', 'b@example.com');`,
  );
});

describe("save_day", () => {
  it("creates the day with its earnings and expenses", async () => {
    const r = await save(ALICE, payload());
    expect(r).toMatchObject({ id: DAY_ID, applied: true });
    expect(await dayRow(ALICE)).toMatchObject({
      id: DAY_ID,
      minutes: 510,
      km: 142,
      shifts: ["evening", "night"],
      gross: 25250,
      n_earn: 2,
      spent: 8500,
    });
    const x = await db.query(
      `select liters, odometer_km, full_tank, user_id from public.expenses`,
    );
    expect(x.rows[0]).toMatchObject({
      liters: "14.200",
      odometer_km: 52340,
      full_tank: true,
      user_id: ALICE,
    });
  });

  it("is idempotent: sending the same edit twice changes nothing", async () => {
    await save(ALICE, payload());
    const again = await save(ALICE, payload());
    expect(again).toMatchObject({ id: DAY_ID, applied: false });
    expect((await dayRow(ALICE))!.n_earn).toBe(2);
  });

  it("a newer edit replaces items; an older one is ignored", async () => {
    await save(ALICE, payload());
    const newer = await save(
      ALICE,
      payload({
        client_updated_at: "2026-11-24T01:00:00Z",
        km: 150,
        earnings: [
          {
            id: E1,
            source: "uber",
            label: null,
            amount_cents: 30000,
            minutes: null,
          },
        ],
        expenses: [],
      }),
    );
    expect(newer.applied).toBe(true);
    expect(await dayRow(ALICE)).toMatchObject({
      km: 150,
      gross: 30000,
      n_earn: 1,
      spent: 0,
    });

    const older = await save(
      ALICE,
      payload({ client_updated_at: "2026-11-23T22:00:00Z", km: 1 }),
    );
    expect(older.applied).toBe(false);
    expect((await dayRow(ALICE))!.km).toBe(150);
  });

  it("merges a date registered under another id (another phone)", async () => {
    await save(ALICE, payload());
    const r = await save(
      ALICE,
      payload({
        id: OTHER_ID,
        client_updated_at: "2026-11-24T02:00:00Z",
        earnings: [],
        km: 99,
      }),
    );
    expect(r).toMatchObject({ id: DAY_ID, applied: true });
    expect(await dayRow(ALICE)).toMatchObject({
      id: DAY_ID,
      km: 99,
      n_earn: 0,
    });
  });

  it("stores a day off and null shifts", async () => {
    await save(
      ALICE,
      payload({
        is_day_off: true,
        shifts: null,
        earnings: [],
        expenses: [],
        minutes: null,
        km: null,
      }),
    );
    expect(await dayRow(ALICE)).toMatchObject({
      is_day_off: true,
      shifts: null,
      minutes: null,
      km: null,
    });
  });

  it("keeps users apart: the same date for two users are two days", async () => {
    await save(ALICE, payload());
    await save(BOB, payload({ id: OTHER_ID, earnings: [], expenses: [] }));
    expect((await dayRow(ALICE))!.gross).toBe(25250);
    expect((await dayRow(BOB))!.gross).toBe(0);
    const seen = await runAs(
      db,
      BOB,
      `select count(*)::int as n from public.earnings`,
    );
    expect(seen.rows[0]!.n).toBe(0);
  });

  it("rejects anonymous calls and bad data", async () => {
    await expect(
      runAs(db, null, `select public.save_day($1::jsonb)`, [
        JSON.stringify(payload()),
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(save(ALICE, payload({ date: null }))).rejects.toThrow(
      /invalid payload/,
    );
    await expect(
      save(
        ALICE,
        payload({ earnings: [{ id: E1, source: "uber", amount_cents: -5 }] }),
      ),
    ).rejects.toThrow();
    await expect(save(ALICE, payload({ shifts: ["lunch"] }))).rejects.toThrow();
    await expect(save(ALICE, payload({ minutes: 5000 }))).rejects.toThrow();
  });
});
