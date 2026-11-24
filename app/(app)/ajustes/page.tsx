import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountData } from "@/components/ajustes/AccountData";
import { MaintenanceList } from "@/components/ajustes/MaintenanceList";
import { PlatformFees } from "@/components/ajustes/PlatformFees";
import { WorkSettings } from "@/components/ajustes/WorkSettings";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import { CapsLabel, Card } from "@/components/ui/Card";
import { can } from "@/lib/entitlements";
import { getAccessUser } from "@/lib/entitlements-server";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { loadMaintenanceItems } from "@/lib/profile/maintenance-server";
import { loadAppContext } from "@/lib/profile/server";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const [ctx, user, maintenance] = await Promise.all([
    loadAppContext(),
    getAccessUser(),
    loadMaintenanceItems(),
  ]);
  if (!ctx || !user) redirect(LOGIN_PATH);
  const paid = can(user, "app");

  return (
    <Screen>
      <ScreenHeader title="Ajustes" />

      <Card as="section" aria-labelledby="conta" className="px-4 pt-3.5 pb-3">
        <CapsLabel as="h2" id="conta">
          Conta
        </CapsLabel>
        <div className="mt-1 text-[16px] font-bold break-words">
          {user.email ?? "—"}
        </div>
        <div className="mt-0.5 text-[13px] font-semibold text-muted">
          {paid ? "Km+ completo · compra única" : "Sem compra ainda"}
        </div>
        {!paid ? (
          <Link
            href="/comprar"
            className="mt-2 flex h-touch items-center text-[15px] font-extrabold underline underline-offset-4"
          >
            Ver a compra
          </Link>
        ) : null}
      </Card>

      <WorkSettings
        apps={ctx.apps}
        goalCents={ctx.monthlyGoalCents}
        hoursPerDay={ctx.typicalHoursPerDay}
        daysPerMonth={ctx.typicalDaysPerMonth}
      />
      <PlatformFees settings={ctx.platformSettings} />

      {paid ? (
        <Link
          href="/painel/lucro"
          className="flex min-h-13 items-center justify-between rounded-card border border-border bg-surface px-4 text-[15px] font-extrabold"
        >
          Carro e Reserva do carro
          <span aria-hidden="true" className="text-muted">
            ›
          </span>
        </Link>
      ) : null}

      <MaintenanceList items={maintenance} />
      <AccountData />

      <Card as="section" aria-labelledby="sobre" className="px-4 pt-3.5 pb-3">
        <CapsLabel as="h2" id="sobre">
          Sobre
        </CapsLabel>
        <nav aria-label="Documentos" className="mt-1 flex flex-col">
          <Link
            href="/termos"
            className="flex h-touch items-center border-b border-divider text-[15px] font-bold"
          >
            Termos de uso
          </Link>
          <Link
            href="/privacidade"
            className="flex h-touch items-center text-[15px] font-bold"
          >
            Política de privacidade
          </Link>
        </nav>
        <p className="mt-2 text-[12px] font-semibold text-muted">
          Estimativas não garantem ganhos. O Km+ não é aconselhamento financeiro
          ou tributário. Km+ não é afiliado à Uber nem à 99.
        </p>
      </Card>

      <SignOutButton />
    </Screen>
  );
}
