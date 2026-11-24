"use client";

import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let client: SupabaseClient | undefined;

/**
 * Only for ASKING for the e-mail link. Uses the implicit flow, so the link in
 * the e-mail carries the session itself and works in any browser or device
 * (the cookie client is forced to PKCE, whose link only works in the same
 * browser that asked for it). It stores nothing: /auth/link saves the session.
 */
export function otpClient(): SupabaseClient {
  if (!client) {
    const { url, key } = supabaseEnv();
    client = createSupabaseClient(url, key, {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
