import "server-only";
import type { MaintenanceItem } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";

export async function loadMaintenanceItems(): Promise<MaintenanceItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_items")
    .select("id,name,interval_km,last_done_km,last_done_date")
    .order("created_at");
  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    intervalKm: m.interval_km,
    lastDoneKm: m.last_done_km,
    lastDoneDate: m.last_done_date,
  }));
}
