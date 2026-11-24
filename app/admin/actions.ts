"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdminEmail } from "@/lib/admin";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return isAdminEmail(
    typeof data?.claims?.email === "string" ? data.claims.email : null,
  );
}

export async function grantAccess(userId: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Sem permissão." };
  const id = z.uuid().safeParse(userId);
  if (!id.success) return { ok: false, error: "Usuário inválido." };
  const { error } = await adminClient()
    .from("entitlements")
    .insert({ user_id: id.data, plan: "premium", source: "manual" });
  if (error && error.code !== "23505")
    return { ok: false, error: "Não deu para liberar." };
  revalidatePath("/admin");
  return { ok: true };
}

export async function revokeAccess(
  userId: unknown,
  reason: unknown,
): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Sem permissão." };
  const id = z.uuid().safeParse(userId);
  const why = z.string().trim().min(1).max(200).safeParse(reason);
  if (!id.success || !why.success)
    return { ok: false, error: "Informe o motivo." };
  const { error } = await adminClient()
    .from("entitlements")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: why.data })
    .eq("user_id", id.data)
    .is("revoked_at", null);
  if (error) return { ok: false, error: "Não deu para revogar." };
  revalidatePath("/admin");
  return { ok: true };
}
