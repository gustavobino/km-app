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

export type TestUser = { id: string; email: string };

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
