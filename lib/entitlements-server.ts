import "server-only";
import { cache } from "react";
import {
  activePlan,
  type AccessUser,
  type EntitlementRow,
} from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user with their active plan (read through RLS). Null when signed out. */
export const getAccessUser = cache(async function getAccessUser(): Promise<
  (AccessUser & { email: string | null }) | null
> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  const { data: rows } = await supabase
    .from("entitlements")
    .select("plan,revoked_at");
  return {
    id,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
    plan: activePlan((rows ?? []) as EntitlementRow[]),
  };
});
