import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let admin: SupabaseClient | undefined;

/**
 * Service-role client: bypasses RLS. Server only, and only for webhook,
 * admin and account deletion. Never import from client code.
 */
export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  if (!admin) {
    admin = createClient(supabaseEnv().url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
