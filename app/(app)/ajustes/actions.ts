"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { maintenanceItemSchema } from "@/lib/schemas/maintenance";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { chosenApps } from "@/lib/onboarding";
import {
  platformSettingSchema,
  workSettingsSchema,
} from "@/lib/schemas/settings";
import { adminClient } from "@/lib/supabase/admin";
import { reminderInputSchema } from "@/lib/schemas/reminder";

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

export async function saveWorkSettings(input: unknown): Promise<ActionResult> {
  const parsed = workSettingsSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Confira os valores informados." };
  const { supabase, userId } = await session();
  if (!userId)
    return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const apps = chosenApps(parsed.data.apps);

  const { error } = await supabase
    .from("profiles")
    .update({
      apps: apps.map((a) => (a.source === "other" ? a.label! : a.source)),
      monthly_goal_cents: parsed.data.goalCents,
      typical_hours_per_day: parsed.data.hoursPerDay,
      typical_days_per_month: parsed.data.daysPerMonth,
    })
    .eq("id", userId);
  if (error) return { ok: false, error: OFFLINE };

  // Keep one fee setting per chosen app (new apps start as "net_already"; existing ones keep their mode).
  const { data: existing } = await supabase
    .from("platform_settings")
    .select("id,source,label");
  const key = (s: string, l: string | null) =>
    `${s}:${(l ?? "").trim().toLowerCase()}`;
  const wanted = new Set(apps.map((a) => key(a.source, a.label)));
  const have = new Set((existing ?? []).map((e) => key(e.source, e.label)));
  const stale = (existing ?? [])
    .filter((e) => !wanted.has(key(e.source, e.label)))
    .map((e) => e.id);
  if (stale.length)
    await supabase.from("platform_settings").delete().in("id", stale);
  const missing = apps.filter((a) => !have.has(key(a.source, a.label)));
  if (missing.length) {
    const { error: insErr } = await supabase.from("platform_settings").insert(
      missing.map((a) => ({
        user_id: userId,
        source: a.source,
        label: a.label,
        mode: "net_already",
      })),
    );
    if (insErr) return { ok: false, error: OFFLINE };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function savePlatformSetting(
  input: unknown,
): Promise<ActionResult> {
  const parsed = platformSettingSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Confira o percentual ou o valor do passe." };
  const { supabase, userId } = await session();
  if (!userId)
    return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const s = parsed.data;
  const row = {
    mode: s.mode,
    percent: s.mode === "percent" ? s.percent : null,
    pass_cents: s.mode === "pass" ? s.passCents : null,
    pass_period: s.mode === "pass" ? s.passPeriod : null,
  };
  let q = supabase.from("platform_settings").update(row).eq("source", s.source);
  q = s.label ? q.eq("label", s.label) : q.is("label", null);
  const { data, error } = await q.select("id");
  if (error) return { ok: false, error: OFFLINE };
  if (!data?.length) {
    const { error: insErr } = await supabase
      .from("platform_settings")
      .insert({ user_id: userId, source: s.source, label: s.label, ...row });
    if (insErr) return { ok: false, error: OFFLINE };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Deletes the account and all its data (LGPD). Payments stay, without the
 * user link, as a fiscal record. Requires typing EXCLUIR.
 */
export async function deleteAccount(
  confirmation: unknown,
): Promise<ActionResult> {
  if (
    typeof confirmation !== "string" ||
    confirmation.trim().toUpperCase() !== "EXCLUIR"
  ) {
    return { ok: false, error: "Digite EXCLUIR para confirmar." };
  }
  const { supabase, userId } = await session();
  if (!userId)
    return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const { error } = await adminClient().auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleteAccount failed:", error.message);
    return {
      ok: false,
      error: "Não deu para excluir agora. Tente de novo em instantes.",
    };
  }
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  redirect("/entrar?conta=excluida");
}

/** "Lembrete para fechar o dia": time + this device's push subscription. */
export async function saveReminder(input: unknown): Promise<ActionResult> {
  const parsed = reminderInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Não deu para ligar o lembrete neste aparelho.",
    };
  const { supabase, userId } = await session();
  if (!userId)
    return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const { enabled, time, subscription } = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({ reminder_enabled: enabled, reminder_time: `${time}:00` })
    .eq("id", userId);
  if (error) return { ok: false, error: OFFLINE };

  if (subscription) {
    // The same browser may have been used by another account: the endpoint moves to this one.
    await adminClient()
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", subscription.endpoint);
    if (enabled) {
      const { error: subErr } = await supabase
        .from("push_subscriptions")
        .insert({ user_id: userId, ...subscription });
      if (subErr) return { ok: false, error: OFFLINE };
    }
  }
  return { ok: true };
}
