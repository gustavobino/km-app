"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Browser Supabase client (singleton). Uses the PKCE flow and cookie storage. */
export function createClient() {
  if (!client) {
    const { url, key } = supabaseEnv();
    client = createBrowserClient(url, key);
  }
  return client;
}
