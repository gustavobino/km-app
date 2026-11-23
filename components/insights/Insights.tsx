"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import { CapsLabel, Card, HeroCard } from "@/components/ui/Card";
import {
  ClockIcon,
  FuelIcon,
  MoonIcon,
  ShieldIcon,
  TrendUpIcon,
  WrenchIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/States";
import {
  addDays,
  formatRange,
  today,
  weekRange,
  type LocalDate,
} from "@/lib/dates";
import {
  computeInsights,
  restStreak,
  weekSummary,
  type InsightIcon,
  type MaintenanceItem,
} from "@/lib/insights";
import { localDb } from "@/lib/local/db";
import { getMeta, listLocalDays, setMeta } from "@/lib/local/days";
import { monthReserve, type ReserveContext } from "@/lib/metrics/month-reserve";
import type { PlatformSetting } from "@/lib/metrics/types";
import { formatBRL } from "@/lib/money";

type Props = {
  userId: string;
  platformSettings: PlatformSetting[];
  maintenance: MaintenanceItem[];
  vehicleModeEnabled: boolean;
  reserveContext: ReserveContext;
};

const ICONS: Record<InsightIcon, ReactNode> = {
  clock: <ClockIcon />,
  trend: <TrendUpIcon />,
  wrench: <WrenchIcon />,
  shield: <ShieldIcon />,
  fuel: <FuelIcon />,
};

export function Insights({
  userId,
  platformSettings,
  maintenance,
  vehicleModeEnabled,
  reserveContext,
}: Props) {
  const [todayDate] = useState<LocalDate>(() => today());
  const week = weekRange(todayDate);
  const days = useLiveQuery(
    () =>
      listLocalDays(localDb(), userId, {
        start: addDays(todayDate, -365),
        end: todayDate,
      }),
    [userId, todayDate],
  );
  const dismissKey = `restDismissed:${userId}`;
  const dismissedWeek = useLiveQuery(
    () => getMeta<string>(localDb(), dismissKey),
    [dismissKey],
  );

  const data = useMemo(() => {
    if (!days) return null;
    const reserve = vehicleModeEnabled
      ? monthReserve(days, todayDate, reserveContext, platformSettings).reserve
      : null;
    return {
      summary: weekSummary(days, platformSettings, todayDate),
      cards: computeInsights({
        days,
        settings: platformSettings,
        today: todayDate,
        maintenance,
        reservePerDayDrivenCents: reserve?.perDayDrivenCents ?? null,
        vehicleModeEnabled,
      }),
      streak: restStreak(days, todayDate),
    };
  }, [
    days,
    platformSettings,
    todayDate,
    maintenance,
    vehicleModeEnabled,
    reserveContext,
  ]);

  const header = <ScreenHeader title="Insights" caption={formatRange(week)} />;

  if (!data) {
    return (
      <Screen>
        {header}
        <div aria-busy="true" className="flex flex-col gap-gap-card">
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-32 rounded-hero" />
          <Skeleton className="h-19" />
          <Skeleton className="h-19" />
        </div>
      </Screen>
    );
  }

  const showRest = data.streak != null && dismissedWeek !== week.start;

  return (
    <Screen>
      {header}
      <HeroCard className="px-5 pt-4.5 pb-5">
        <CapsLabel as="h2" onLime>
          Resumo da semana
        </CapsLabel>
        {data.summary ? (
          <p className="mt-2 font-display text-[21px] leading-[1.35] font-bold tracking-[-0.01em]">
            Você sobrou{" "}
            <span className="rounded-lg bg-ink px-2 font-extrabold whitespace-nowrap text-lime">
              {formatBRL(data.summary.netCents, { cents: false })}
            </span>{" "}
            na semana. {data.summary.text.join(" ")}
          </p>
        ) : (
          <p className="mt-2 font-display text-[21px] leading-[1.35] font-bold tracking-[-0.01em]">
            Sua semana começa aqui.{" "}
            <Link href="/registrar" className="underline underline-offset-4">
              Registre o primeiro dia
            </Link>{" "}
            para ver o resumo.
          </p>
        )}
      </HeroCard>

      {data.cards.map((c) => (
        <Card
          as="article"
          key={c.id}
          className="flex min-h-19 items-center gap-3.5 px-4 py-3.5"
        >
          <span
            aria-hidden="true"
            className="flex size-11 flex-none items-center justify-center rounded-[14px] bg-bg"
          >
            {ICONS[c.icon]}
          </span>
          <div>
            <h3 className="text-[15px] font-extrabold">{c.title}</h3>
            <p className="mt-0.5 text-[13px] font-semibold text-muted">
              {c.body}
            </p>
          </div>
        </Card>
      ))}

      {data.cards.length === 0 ? (
        <Card className="px-4 py-3.5">
          <p className="text-[14px] font-semibold text-muted">
            Os insights aparecem conforme você registra. Com 3 semanas de dias
            com horas, mostramos seus melhores dias e horários.
          </p>
        </Card>
      ) : null}

      {maintenance.length === 0 ? (
        <Link
          href="/ajustes"
          className="px-1 text-[13px] font-bold text-muted underline underline-offset-4"
        >
          Quer aviso de troca de óleo e revisão? Cadastre em Ajustes.
        </Link>
      ) : null}

      {showRest ? (
        <div className="flex items-center gap-2.5 px-1.5 py-1 text-[13px] font-semibold text-muted">
          <MoonIcon />
          <span className="flex-1">
            {data.streak} dias seguidos rodando. Uma folga ajuda o rendimento.
          </span>
          <button
            type="button"
            onClick={() => void setMeta(localDb(), dismissKey, week.start)}
            className="h-touch px-1 font-bold underline underline-offset-4"
          >
            Dispensar
          </button>
        </div>
      ) : null}
    </Screen>
  );
}
