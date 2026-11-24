import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SimulatorClient } from "@/components/simulador/SimulatorClient";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { loadAppContext } from "@/lib/profile/server";

export const metadata: Metadata = { title: "Simulador" };

export default async function SimulatorPage() {
  const ctx = await loadAppContext();
  if (!ctx) redirect(LOGIN_PATH);
  return (
    <SimulatorClient
      userId={ctx.userId}
      platformSettings={ctx.platformSettings}
      monthlyGoalCents={ctx.monthlyGoalCents}
      typicalHoursPerDay={ctx.typicalHoursPerDay}
      typicalDaysPerMonth={ctx.typicalDaysPerMonth}
    />
  );
}
