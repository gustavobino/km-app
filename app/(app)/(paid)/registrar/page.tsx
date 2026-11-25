import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterDayClient } from "@/components/day/RegisterDayClient";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { loadAppContext } from "@/lib/profile/server";

export const metadata: Metadata = { title: "Registrar o dia" };

export default async function RegisterPage() {
  const ctx = await loadAppContext();
  if (!ctx) redirect(LOGIN_PATH);
  return (
    <RegisterDayClient
      userId={ctx.userId}
      apps={ctx.apps}
      platformSettings={ctx.platformSettings}
      monthlyGoalCents={ctx.monthlyGoalCents}
      reminderEnabled={ctx.reminderEnabled}
    />
  );
}
