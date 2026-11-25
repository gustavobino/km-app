import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { YearClient } from "@/components/ano/YearClient";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { loadAppContext } from "@/lib/profile/server";

export const metadata: Metadata = { title: "Resumo do ano" };

export default async function YearPage() {
  const ctx = await loadAppContext();
  if (!ctx) redirect(LOGIN_PATH);
  return (
    <YearClient userId={ctx.userId} platformSettings={ctx.platformSettings} />
  );
}
