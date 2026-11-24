import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/painel/DashboardClient";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { loadAppContext } from "@/lib/profile/server";

export const metadata: Metadata = { title: "Painel" };

export default async function PainelPage() {
  const ctx = await loadAppContext();
  if (!ctx) redirect(LOGIN_PATH);
  return (
    <DashboardClient
      userId={ctx.userId}
      platformSettings={ctx.platformSettings}
      monthlyGoalCents={ctx.monthlyGoalCents}
    />
  );
}
