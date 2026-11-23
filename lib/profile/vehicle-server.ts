import "server-only";
import type { CostReference, Ownership, Vehicle } from "@/lib/metrics/vehicle";
import { createClient } from "@/lib/supabase/server";

export type VehicleContext = {
  ownership: Ownership | null;
  vehicleModeEnabled: boolean;
  typicalDaysPerMonth: number | null;
  vehicle: (Vehicle & { brand: string | null; model: string | null }) | null;
  reference: CostReference[];
};

const num = (v: unknown) => (v == null ? null : Number(v));

export async function loadVehicleContext(
  userId: string,
): Promise<VehicleContext> {
  const supabase = await createClient();
  const [{ data: profile }, { data: v }, { data: ref }] = await Promise.all([
    supabase
      .from("profiles")
      .select("vehicle_ownership,vehicle_mode_enabled,typical_days_per_month")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("vehicles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("cost_reference")
      .select(
        "category,age_band,maintenance_cents_per_km,tires_cents_per_km,is_placeholder",
      ),
  ]);
  return {
    ownership: (profile?.vehicle_ownership as Ownership | null) ?? null,
    vehicleModeEnabled: Boolean(profile?.vehicle_mode_enabled),
    typicalDaysPerMonth:
      (profile?.typical_days_per_month as number | null) ?? null,
    vehicle: v
      ? {
          brand: v.brand,
          model: v.model,
          category: v.category,
          year: v.year,
          rentCents: v.rent_cents,
          rentPeriod: v.rent_period,
          installmentCents: v.installment_cents,
          insuranceYearCents: v.insurance_year_cents,
          ipvaYearCents: v.ipva_year_cents,
          maintenanceCentsPerKm: num(v.maintenance_cents_per_km),
          tiresCentsPerKm: num(v.tires_cents_per_km),
        }
      : null,
    reference: (ref ?? []).map((r) => ({
      category: r.category,
      ageBand: r.age_band,
      maintenanceCentsPerKm: Number(r.maintenance_cents_per_km),
      tiresCentsPerKm: Number(r.tires_cents_per_km),
      isPlaceholder: r.is_placeholder,
    })),
  };
}
