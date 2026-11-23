"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { maintenanceItemSchema } from "@/lib/schemas/maintenance";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };
const OFFLINE =
  "Não deu para salvar agora. Confira a internet e tente de novo.";

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

export async function saveMaintenanceItem(
  input: unknown,
): Promise<ActionResult> {
  const parsed = maintenanceItemSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Confira o nome e o intervalo em km." };
  const { supabase, userId } = await session();
  if (!userId)
    return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const v = parsed.data;
  const row = {
    user_id: userId,
    name: v.name,
    interval_km: v.intervalKm,
    last_done_km: v.lastDoneKm,
    last_done_date: v.lastDoneDate,
  };
  const { error } = v.id
    ? await supabase.from("maintenance_items").update(row).eq("id", v.id)
    : await supabase.from("maintenance_items").insert(row);
  if (error) return { ok: false, error: OFFLINE };
  revalidatePath("/ajustes");
  revalidatePath("/insights");
  return { ok: true };
}

export async function deleteMaintenanceItem(
  id: unknown,
): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: OFFLINE };
  const { supabase, userId } = await session();
  if (!userId)
    return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const { error } = await supabase
    .from("maintenance_items")
    .delete()
    .eq("id", parsed.data);
  if (error) return { ok: false, error: OFFLINE };
  revalidatePath("/ajustes");
  revalidatePath("/insights");
  return { ok: true };
}
