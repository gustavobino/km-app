import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LucroClient } from "@/components/lucro/LucroClient";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { loadAppContext } from "@/lib/profile/server";
import { loadVehicleContext } from "@/lib/profile/vehicle-server";

export const metadata: Metadata = { title: "Lucro líquido" };

export default async function LucroPage() {
  const ctx = await loadAppContext();
  if (!ctx) redirect(LOGIN_PATH);
  const vehicle = await loadVehicleContext(ctx.userId);
  return (
    <LucroClient
      userId={ctx.userId}
      platformSettings={ctx.platformSettings}
      vehicleContext={vehicle}
    />
  );
}
