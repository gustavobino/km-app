import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import { TabBar } from "@/components/layout/TabBar";
import { CapsLabel, Card, HeroCard } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DayBars } from "@/components/ui/DayBars";
import { ArrowRightIcon, GearIcon, TriangleIcon } from "@/components/ui/icons";
import { HeroMoney } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/States";
import { DevControls } from "./DevControls";

/**
 * DEV ONLY: rebuilds the reference "Painel" with the base components and the
 * CLAUDE.md example numbers, to check tokens against design/project/Painel.dc.html.
 * Not available in production builds.
 */
export const metadata: Metadata = {
  title: "Componentes (dev)",
  robots: { index: false },
};

const WEEK = [
  { key: "seg", label: "Seg", value: 0 },
  { key: "ter", label: "Ter", value: 20 },
  { key: "qua", label: "Qua", value: 0 },
  { key: "qui", label: "Qui", value: 60 },
  { key: "sex", label: "Sex", value: 160 },
  { key: "sab", label: "Sáb", value: 280, best: true },
  { key: "dom", label: "Dom", value: 180 },
];

export default function ComponentsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <Screen>
        <ScreenHeader
          title="Painel"
          caption="23 a 29 de novembro"
          trailing={
            <Link
              href="#"
              aria-label="Ajustes"
              className="-mr-2.5 flex size-touch items-center justify-center"
            >
              <GearIcon />
            </Link>
          }
        />
        <DevControls />

        <HeroCard className="px-5 pt-4.5 pb-1">
          <div className="flex items-center justify-between gap-2">
            <CapsLabel onLime className="font-extrabold">
              Sobrou no bolso na semana
            </CapsLabel>
            <span className="flex h-7 flex-none items-center gap-1 rounded-[14px] bg-ink px-2.5 text-xs font-extrabold text-lime">
              <TriangleIcon />
              8%<span className="sr-only"> a mais que na semana passada</span>
            </span>
          </div>
          <HeroMoney value={152800} className="mt-1.5" />
          <p className="mt-1.5 text-sm font-semibold text-lime-text">
            Ganhos R$ 2.140,00 · gastos R$ 612,00
          </p>
          <DayBars
            bars={WEEK}
            label="Quanto sobrou por dia. O melhor dia foi sábado."
            className="mt-3"
          />
          <Link
            href="#"
            className="mt-3 flex h-12 items-center justify-between border-t border-lime-divider text-sm font-extrabold"
          >
            Ver o lucro líquido do mês
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-ink text-lime"
            >
              <ArrowRightIcon />
            </span>
          </Link>
        </HeroCard>

        <div className="grid grid-cols-2 gap-2.5">
          {[
            ["Ganho por hora", "R$ 41,15", "em 52 h rodadas"],
            ["Ganho por km", "R$ 2,43", "em 880 km rodados"],
          ].map(([t, v, s]) => (
            <Card key={t} className="px-4 py-3">
              <div className="text-xs font-bold text-muted">{t}</div>
              <div className="font-display text-[30px] leading-[1.1] font-extrabold">
                {v}
              </div>
              <div className="text-xs font-semibold text-muted">{s}</div>
            </Card>
          ))}
        </div>

        <HeroCard radius="hero-md" className="px-4 pt-3.5 pb-4">
          <div className="mb-2.5 flex items-baseline justify-between">
            <CapsLabel onLime>Meta do mês · R$ 8.000</CapsLabel>
            <span className="font-display text-[26px] font-extrabold">80%</span>
          </div>
          <ProgressBar ratio={0.8} onLime label="80% da meta do mês" />
          <p className="mt-2.5 text-[13px] font-bold text-lime-text">
            Faltam R$ 1.600 · cerca de R$ 229 por dia nos 7 dias que restam
          </p>
        </HeroCard>

        <Card className="px-4 pt-3.5 pb-4">
          <CapsLabel className="mb-2.5">Gastos do dia</CapsLabel>
          <div className="flex flex-wrap gap-2">
            <Chip selected removable aria-label="Remover Combustível, R$ 85,00">
              Combustível · 85,00
            </Chip>
            <Chip>+ Pedágio</Chip>
          </div>
        </Card>

        <Skeleton className="h-24" />
      </Screen>
      <TabBar />
    </>
  );
}
