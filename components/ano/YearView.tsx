"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Screen } from "@/components/layout/Screen";
import { RateCards } from "@/components/painel/Dashboard";
import { LinkButton } from "@/components/ui/Button";
import { CapsLabel, Card, HeroCard } from "@/components/ui/Card";
import { DayBars } from "@/components/ui/DayBars";
import { ArrowLeftIcon, ChevronDownIcon } from "@/components/ui/icons";
import { HeroMoney } from "@/components/ui/Money";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { formatMonthName, today, type LocalDate } from "@/lib/dates";
import { appLabel } from "@/lib/day/form";
import { localDb } from "@/lib/local/db";
import { listLocalDays } from "@/lib/local/days";
import type { PlatformSetting } from "@/lib/metrics/types";
import { yearRange, yearSummary } from "@/lib/metrics/year";
import { formatBRL } from "@/lib/money";

type Props = { userId: string; platformSettings: PlatformSetting[] };

const MONTH_LETTERS = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];

/** "Resumo do ano": rendered only in the browser (data lives in IndexedDB). */
export function YearView({ userId, platformSettings }: Props) {
  const [todayDate] = useState<LocalDate>(() => today());
  const currentYear = Number(todayDate.slice(0, 4));
  const [year, setYear] = useState(currentYear);

  const days = useLiveQuery(
    () => listLocalDays(localDb(), userId, yearRange(year)),
    [userId, year],
  );
  const data = useMemo(
    () => (days ? yearSummary(days, year, platformSettings, todayDate) : null),
    [days, year, platformSettings, todayDate],
  );

  const header = (
    <header className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Link
          href="/painel"
          aria-label="Voltar ao painel"
          className="-ml-2.5 flex size-touch items-center justify-center"
        >
          <ArrowLeftIcon />
        </Link>
        <h1 className="font-display text-[26px] leading-[1.1] font-extrabold">
          Resumo do ano
        </h1>
      </div>
      <div className="flex items-center">
        <button
          type="button"
          aria-label="Ano anterior"
          onClick={() => setYear((y) => y - 1)}
          className="flex size-touch items-center justify-center"
        >
          <ChevronDownIcon className="rotate-90" />
        </button>
        <span
          className="font-display text-[18px] font-extrabold"
          aria-live="polite"
        >
          {year}
        </span>
        <button
          type="button"
          aria-label="Próximo ano"
          disabled={year >= currentYear}
          onClick={() => setYear((y) => y + 1)}
          className="flex size-touch items-center justify-center disabled:text-border"
        >
          <ChevronDownIcon className="-rotate-90" />
        </button>
      </div>
    </header>
  );

  if (!data) {
    return (
      <Screen className="pt-5">
        {header}
        <div aria-busy="true" className="flex flex-col gap-gap-card">
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-48 rounded-hero" />
          <Skeleton className="h-40" />
        </div>
      </Screen>
    );
  }

  const { summary, months, best, apps } = data;
  if (summary.grossCents === 0 && summary.expensesCents === 0) {
    return (
      <Screen className="pt-5">
        {header}
        <EmptyState
          title={`Nenhum dia registrado em ${year}`}
          description="Assim que você registrar, o resumo do ano aparece aqui."
          action={
            year === currentYear ? (
              <LinkButton href="/registrar" block>
                Registrar o dia
              </LinkButton>
            ) : undefined
          }
        />
      </Screen>
    );
  }

  return (
    <Screen className="pt-5">
      {header}

      <HeroCard className="px-5 pt-5 pb-5">
        <CapsLabel as="h2" onLime>
          Sobrou no bolso em {year}
        </CapsLabel>
        <HeroMoney value={summary.netCents} size="lg" className="mt-1" />
        <p className="mt-2 text-sm font-bold text-lime-text">
          {formatBRL(summary.grossCents, { cents: false })} ganhos em{" "}
          {summary.daysWorked}{" "}
          {summary.daysWorked === 1 ? "dia rodado" : "dias rodados"}
        </p>
        <DayBars
          compact
          className="mt-4"
          height={64}
          bars={months.map((m, i) => ({
            key: m.start,
            label: MONTH_LETTERS[i]!,
            value: m.future ? 0 : m.netCents,
            best: best?.start === m.start,
          }))}
          label={
            best
              ? `Quanto sobrou por mês. O melhor foi ${formatMonthName(best.start)}, com ${formatBRL(best.netCents, { cents: false })}.`
              : "Quanto sobrou por mês."
          }
        />
        {best ? (
          <p className="mt-3 text-sm font-bold">
            Melhor mês: {formatMonthName(best.start)}, com{" "}
            {formatBRL(best.netCents, { cents: false })} no bolso.
          </p>
        ) : null}
      </HeroCard>

      <Card as="section" aria-label="Contas do ano" className="px-4 py-1">
        <Row
          label="Ganhos do ano"
          value={formatBRL(summary.grossCents)}
          strong
        />
        {summary.platformFeeCents > 0 ? (
          <Row
            label="Taxas dos apps"
            value={`− ${formatBRL(summary.platformFeeCents)}`}
          />
        ) : null}
        <Row label="Gastos" value={`− ${formatBRL(summary.expensesCents)}`} />
        <Row
          label="Sobrou no bolso"
          value={formatBRL(summary.netCents)}
          strong
        />
        {data.netPerDayCents != null ? (
          <Row
            label="Média por dia rodado"
            value={formatBRL(data.netPerDayCents)}
          />
        ) : null}
      </Card>

      <RateCards
        minutes={summary.minutes}
        km={summary.km}
        perHour={summary.grossPerHourCents}
        perKm={summary.grossPerKmCents}
      />

      {apps.length > 0 ? (
        <Card
          as="section"
          aria-label="Ganhos por app"
          className="px-4 pt-3.5 pb-2"
        >
          <CapsLabel as="h2" className="mb-1">
            Quanto veio de cada app
          </CapsLabel>
          {apps.map((a) => (
            <Row
              key={a.key}
              label={appLabel(a.source, a.label)}
              value={`${formatBRL(a.cents, { cents: false })} · ${Math.round(a.share * 100)}%`}
            />
          ))}
        </Card>
      ) : null}

      <p className="px-1 text-[12px] font-semibold text-muted">
        Valores que você registrou no Km+. Servem para conferir sua renda, por
        exemplo na declaração do Imposto de Renda. Não é aconselhamento
        tributário.
      </p>
    </Screen>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex h-11 items-center justify-between border-divider not-first:border-t">
      <span
        className={
          strong ? "text-[15px] font-bold" : "text-sm font-semibold text-muted"
        }
      >
        {label}
      </span>
      <span
        className={
          strong ? "text-[16px] font-extrabold" : "text-[15px] font-bold"
        }
      >
        {value}
      </span>
    </div>
  );
}
