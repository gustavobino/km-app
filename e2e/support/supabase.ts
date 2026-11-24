import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/**
 * Test helpers that talk to the real Supabase project with the secret key.
 * The key comes from SUPABASE_SERVICE_ROLE_KEY, or (cloud dev environment) is
 * fetched from the Management API, whose token the network proxy injects.
 * It is never written to disk.
 */

function readEnvLocal(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  if (!existsSync(".env.local")) return undefined;
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() || undefined;
}

const URL = readEnvLocal("NEXT_PUBLIC_SUPABASE_URL")!;
const PROJECT_REF = new globalThis.URL(URL).hostname.split(".")[0]!;

let admin: SupabaseClient | undefined;

async function secretKey(): Promise<string> {
  const fromEnv = readEnvLocal("SUPABASE_SERVICE_ROLE_KEY");
  if (fromEnv) return fromEnv;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys?reveal=true`,
    {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN ?? "proxy-injected"}`,
      },
    },
  );
  if (!res.ok)
    throw new Error(
      `No SUPABASE_SERVICE_ROLE_KEY and Management API said ${res.status}`,
    );
  const keys = (await res.json()) as Array<{ type: string; api_key: string }>;
  const key = keys.find((k) => k.type === "secret")?.api_key;
  if (!key) throw new Error("No secret key found for the project");
  return key;
}

export async function adminClient(): Promise<SupabaseClient> {
  if (!admin) {
    admin = createClient(URL, await secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export type TestUser = {
  id: string;
  email: string;
  /** Saved browser session (worker accounts): signIn() then just navigates. */
  statePath?: string;
};

export async function createTestUser(
  opts: { onboarded?: boolean; apps?: string[] } = {},
): Promise<TestUser> {
  const db = await adminClient();
  const email = `e2e-${randomUUID()}@example.com`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  if (opts.onboarded) {
    const { error: e } = await db
      .from("profiles")
      .update({
        onboarding_completed_at: new Date().toISOString(),
        apps: opts.apps ?? [],
      })
      .eq("id", data.user.id);
    if (e) throw e;
  }
  return { id: data.user.id, email };
}

export async function deleteTestUser(user: TestUser | undefined) {
  if (!user) return;
  const db = await adminClient();
  await db.auth.admin.deleteUser(user.id);
}

/** Signs the browser in through /auth/confirm, like the custom e-mail link does. */
export async function signIn(page: Page, user: TestUser, next = "/registrar") {
  if (user.statePath) {
    await page.goto(next);
    return;
  }
  const db = await adminClient();
  const { data, error } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error || !data.properties?.hashed_token)
    throw error ?? new Error("generateLink failed");
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: "email",
    next,
  });
  await page.goto(`/auth/confirm?${params}`);
}

export type SeedDay = {
  date: string;
  minutes?: number | null;
  km?: number | null;
  isDayOff?: boolean;
  earnings?: Array<{
    source: "uber" | "99" | "other";
    label?: string | null;
    amount_cents: number;
    minutes?: number | null;
  }>;
  expenses?: Array<{
    category: "fuel" | "food" | "toll" | "parking" | "wash" | "other";
    amount_cents: number;
  }>;
};

/** Inserts days straight into the database (as if registered on another phone). */
export async function seedDays(user: TestUser, days: SeedDay[]) {
  const db = await adminClient();
  for (const d of days) {
    const { data, error } = await db
      .from("days")
      .insert({
        user_id: user.id,
        date: d.date,
        minutes: d.minutes ?? null,
        km: d.km ?? null,
        is_day_off: d.isDayOff ?? false,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (d.earnings?.length) {
      const { error: e } = await db.from("earnings").insert(
        d.earnings.map((x) => ({
          ...x,
          label: x.label ?? null,
          minutes: x.minutes ?? null,
          user_id: user.id,
          day_id: data.id,
        })),
      );
      if (e) throw e;
    }
    if (d.expenses?.length) {
      const { error: e } = await db
        .from("expenses")
        .insert(
          d.expenses.map((x) => ({ ...x, user_id: user.id, day_id: data.id })),
        );
      if (e) throw e;
    }
  }
}

export async function setProfile(
  user: TestUser,
  patch: Record<string, unknown>,
) {
  const db = await adminClient();
  const { error } = await db.from("profiles").update(patch).eq("id", user.id);
  if (error) throw error;
}

export async function setVehicle(
  user: TestUser,
  values: Record<string, unknown>,
) {
  const db = await adminClient();
  const { error } = await db
    .from("vehicles")
    .upsert({ user_id: user.id, ...values }, { onConflict: "user_id" });
  if (error) throw error;
}

/**
 * Wipes a worker account back to a just-onboarded driver, so each test starts
 * clean without signing in again (Supabase allows 30 verifications per 5 min).
 */
export async function resetAccount(
  user: TestUser,
  opts: { apps?: string[] } = {},
): Promise<TestUser> {
  const db = await adminClient();
  for (const table of [
    "days",
    "maintenance_items",
    "vehicles",
    "platform_settings",
  ]) {
    const { error } = await db.from(table).delete().eq("user_id", user.id);
    if (error) throw error;
  }
  await setProfile(user, {
    onboarding_completed_at: new Date().toISOString(),
    apps: opts.apps ?? [],
    vehicle_ownership: null,
    fuel_type: null,
    monthly_goal_cents: null,
    typical_hours_per_day: null,
    typical_days_per_month: null,
    vehicle_mode_enabled: false,
  });
  return user;
}
