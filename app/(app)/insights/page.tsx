import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InsightsClient } from "@/components/insights/InsightsClient";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { loadMaintenanceItems } from "@/lib/profile/maintenance-server";
import { loadAppContext } from "@/lib/profile/server";
import { loadVehicleContext } from "@/lib/profile/vehicle-server";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage() {
  const ctx = await loadAppContext();
  if (!ctx) redirect(LOGIN_PATH);
  const [vehicle, maintenance] = await Promise.all([
    loadVehicleContext(ctx.userId),
    loadMaintenanceItems(),
  ]);
  return (
    <InsightsClient
      userId={ctx.userId}
      platformSettings={ctx.platformSettings}
      maintenance={maintenance}
      vehicleModeEnabled={vehicle.vehicleModeEnabled}
      reserveContext={vehicle}
    />
  );
}
