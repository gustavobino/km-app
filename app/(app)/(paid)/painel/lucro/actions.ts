"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { vehicleInputSchema } from "@/lib/schemas/vehicle";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const OFFLINE =
  "Não deu para salvar agora. Confira a internet e tente de novo.";

async function userClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

export async function setVehicleMode(enabled: unknown): Promise<ActionResult> {
  const parsed = z.boolean().safeParse(enabled);
  if (!parsed.success) return { ok: false, error: OFFLINE };
  const { supabase, userId } = await userClient();
  if (!userId)
    return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const { error } = await supabase
    .from("profiles")
    .update({ vehicle_mode_enabled: parsed.data })
    .eq("id", userId);
  if (error) return { ok: false, error: OFFLINE };
  revalidatePath("/painel/lucro");
  return { ok: true };
}

export async function saveVehicle(input: unknown): Promise<ActionResult> {
  const parsed = vehicleInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Confira os valores informados." };
  const { supabase, userId } = await userClient();
  if (!userId)
    return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const v = parsed.data;

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ vehicle_ownership: v.ownership })
    .eq("id", userId);
  if (pErr) return { ok: false, error: OFFLINE };

  const { error } = await supabase.from("vehicles").upsert(
    {
      user_id: userId,
      brand: v.brand || null,
      model: v.model || null,
      year: v.year,
      category: v.category,
      rent_cents: v.ownership === "rented" ? v.rentCents : null,
      rent_period:
        v.ownership === "rented" && v.rentCents != null ? v.rentPeriod : null,
      installment_cents: v.ownership === "financed" ? v.installmentCents : null,
      insurance_year_cents: v.insuranceYearCents,
      ipva_year_cents: v.ipvaYearCents,
      maintenance_cents_per_km: v.maintenanceCentsPerKm,
      tires_cents_per_km: v.tiresCentsPerKm,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("saveVehicle failed:", error.message);
    return { ok: false, error: OFFLINE };
  }
  revalidatePath("/painel/lucro");
  return { ok: true };
}
