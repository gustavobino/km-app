import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** A PGlite database with the Supabase shim, every migration (in order) and the seed. */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(read("db/test-utils/supabase-shim.sql"));
  const migrations = readdirSync(join(ROOT, "db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrations) await db.exec(read(`db/migrations/${file}`));
  await db.exec(read("db/seed.sql"));
  return db;
}

/** Runs one statement as a signed-in user (or anon when user is null), like PostgREST does. */
export async function runAs(
  db: PGlite,
  user: string | null,
  sql: string,
  params: unknown[] = [],
) {
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
