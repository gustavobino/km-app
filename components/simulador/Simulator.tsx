"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useId, useMemo, useState } from "react";
import { Screen } from "@/components/layout/Screen";
import { CapsLabel, Card, HeroCard } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { addDays, today, type LocalDate } from "@/lib/dates";
import { localDb } from "@/lib/local/db";
import { listLocalDays } from "@/lib/local/days";
import type { PlatformSetting } from "@/lib/metrics/types";
import { formatBRL, parseBRL, toInputBRL } from "@/lib/money";
import {
  SIMULATOR,
  currentMonthly,
  historicalBase,
  simulate,
  type Path,
} from "@/lib/simulator";
import {
  formatHoursDecimal,
  formatHoursFromDecimal,
  parseHours,
} from "@/lib/units";

type Props = {
  userId: string;
  platformSettings: PlatformSetting[];
  monthlyGoalCents: number | null;
  typicalHoursPerDay: number | null;
  typicalDaysPerMonth: number | null;
};

const DEFAULT_HOURS = 8;
const DEFAULT_DAYS = 22;

export function Simulator(props: Props) {
  const [todayDate] = useState<LocalDate>(() => today());
  const days = useLiveQuery(
    () =>
      listLocalDays(localDb(), props.userId, {
        start: addDays(todayDate, -(SIMULATOR.windowDays - 1)),
        end: todayDate,
      }),
    [props.userId, todayDate],
  );
  if (!days) {
    return (
      <Screen>
        <Title />
        <div aria-busy="true" className="flex flex-col gap-gap-card">
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-28" />
          <Skeleton className="h-24" />
          <Skeleton className="h-36 rounded-hero" />
        </div>
      </Screen>
    );
  }
  return <SimulatorForm {...props} todayDate={todayDate} days={days} />;
}

function Title({ caption }: { caption?: string }) {
  return (
    <header>
      <h1 className="font-display text-[30px] leading-[1.1] font-extrabold">
        Simulador de meta
      </h1>
      {caption ? (
        <p className="mt-1 text-[13px] font-semibold text-muted">{caption}</p>
      ) : null}
    </header>
  );
}

function SimulatorForm({
  platformSettings,
  monthlyGoalCents,
  typicalHoursPerDay,
  typicalDaysPerMonth,
  todayDate,
  days,
}: Props & {
  todayDate: LocalDate;
  days: Awaited<ReturnType<typeof listLocalDays>>;
}) {
  const base = useMemo(
    () => historicalBase(days, platformSettings, todayDate),
    [days, platformSettings, todayDate],
  );

  // Routine today: onboarding answers first, then history, then a plain default.
  const routineHours =
    typicalHoursPerDay ??
    (base.avgHoursPerDay
      ? Math.round(base.avgHoursPerDay * 4) / 4
      : DEFAULT_HOURS);
  const routineDays = typicalDaysPerMonth ?? DEFAULT_DAYS;
  const nowMonthly = currentMonthly(
    base.netPerHourCents,
    routineHours,
    routineDays,
  );

  const [target, setTarget] = useState(
    monthlyGoalCents ? toInputBRL(monthlyGoalCents).replace(/,00$/, "") : "",
  );
  const [hours, setHours] = useState(
    formatHoursDecimal(Math.round(routineHours * 60)),
  );
  const [daysText, setDaysText] = useState(String(routineDays));
  const ids = { target: useId(), hours: useId(), days: useId() };

  const hoursMin = parseHours(hours);
  const daysNum = /^\d{1,2}$/.test(daysText.trim()) ? Number(daysText) : NaN;
  const result = simulate({
    targetCents: parseBRL(target) ?? 0,
    hoursPerDay: hoursMin != null ? hoursMin / 60 : NaN,
    daysPerMonth: daysNum > 0 && daysNum <= 31 ? daysNum : NaN,
    baseNetPerHourCents: base.netPerHourCents,
    currentMonthlyCents: nowMonthly,
  });

  const caption =
    base.daysWithHours === 0
      ? "Ainda sem dias com horas registradas"
      : base.thin
        ? `Ainda com pouco histórico: ${base.daysWithHours} ${base.daysWithHours === 1 ? "dia" : "dias"} com horas. Fica mais certo com o tempo.`
        : "Calculado com o seu histórico dos últimos 3 meses";

  const pct =
    result?.aboveRate != null ? Math.round(result.aboveRate * 100) : null;

  return (
    <Screen>
      <Title caption={caption} />

      <Card className="grid grid-cols-2">
        <div className="border-r border-divider px-4 py-3.5">
          <CapsLabel>Hoje você sobra</CapsLabel>
          <div className="mt-1 font-display text-[26px] font-extrabold">
            {nowMonthly != null ? formatBRL(nowMonthly, { cents: false }) : "—"}
          </div>
          <div className="text-[13px] font-semibold text-muted">
            {base.netPerHourCents != null
              ? `${formatBRL(Math.round(base.netPerHourCents))} por hora`
              : "registre dias com horas"}
          </div>
        </div>
        <div className="px-4 py-3.5">
          <label htmlFor={ids.target} className="block label-caps text-muted">
            Quero chegar a
          </label>
          <div className="mt-1 flex items-baseline gap-1">
            <span
              aria-hidden="true"
              className="text-[16px] font-bold text-muted"
            >
              R$
            </span>
            <input
              id={ids.target}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={target}
              aria-describedby={`${ids.target}-sufixo`}
              onChange={(e) =>
                setTarget(e.target.value.replace(/[^\d.,]/g, ""))
              }
              className="h-9 w-full min-w-0 bg-transparent font-display text-[26px] font-extrabold outline-none placeholder:text-muted/40"
            />
          </div>
          <div
            id={`${ids.target}-sufixo`}
            className="text-[13px] font-semibold text-muted"
          >
            por mês
          </div>
        </div>
      </Card>

      <Card className="grid grid-cols-2">
        <div className="border-r border-divider px-4 py-3.5">
          <label htmlFor={ids.hours} className="block label-caps text-muted">
            Horas por dia
          </label>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <input
              id={ids.hours}
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="h-touch w-16 bg-transparent font-display text-[30px] font-extrabold outline-none"
            />
            <span aria-hidden="true" className="font-bold text-muted">
              h
            </span>
          </div>
        </div>
        <div className="px-4 py-3.5">
          <label htmlFor={ids.days} className="block label-caps text-muted">
            Dias por mês
          </label>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <input
              id={ids.days}
              inputMode="numeric"
              value={daysText}
              onChange={(e) =>
                setDaysText(e.target.value.replace(/\D/g, "").slice(0, 2))
              }
              className="h-touch w-12 bg-transparent font-display text-[30px] font-extrabold outline-none"
            />
            <span aria-hidden="true" className="font-bold text-muted">
              dias
            </span>
          </div>
        </div>
      </Card>

      <HeroCard aria-live="polite" className="px-5 pt-4.5 pb-5">
        <CapsLabel as="h2" onLime>
          Para chegar lá, sobrar por dia
        </CapsLabel>
        <div className="mt-0.5 font-display text-[56px] leading-[1.05] font-extrabold tracking-hero">
          {result ? formatBRL(result.perDayCents) : "—"}
        </div>
        <p className="mt-1 text-[15px] font-bold">
          {result
            ? `${formatBRL(result.perHourCents)} por hora`
            : "Preencha a meta, as horas e os dias"}
          {pct != null ? (
            <span className="font-bold text-lime-text">
              {" · "}
              {pct > 0
                ? `${pct}% acima do seu ritmo`
                : pct === 0
                  ? "no seu ritmo atual"
                  : "abaixo do seu ritmo atual"}
            </span>
          ) : null}
        </p>
      </HeroCard>

      {result?.paths ? (
        <Card className="px-4 pt-3.5 pb-3">
          <CapsLabel as="h2" className="mb-1">
            Caminhos para chegar lá
          </CapsLabel>
          <ul>
            <PathRow
              title="Só mais horas"
              note="no seu ritmo de hoje"
              path={result.paths.onlyMoreHours}
            />
            <PathRow
              title={`Ganhar ${Math.round(SIMULATOR.rateBoost * 100)}% mais por hora`}
              note="com os melhores horários"
              path={result.paths.betterRate}
            />
            <PathRow
              title={`Isso + ${SIMULATOR.extraDays} dias a mais`}
              note="o caminho mais equilibrado"
              path={result.paths.betterRateMoreDays}
              highlight
            />
          </ul>
          {result.paths.halfway ? (
            <p className="mt-2 rounded-segment-item bg-bg px-3 py-2.5 text-[13px] font-semibold text-note-text">
              Sem pressa: no meio do caminho,{" "}
              {formatBRL(result.paths.halfway.targetCents, { cents: false })}{" "}
              por mês pedem{" "}
              {formatHoursFromDecimal(result.paths.halfway.hoursPerDay)} por
              dia.
            </p>
          ) : null}
        </Card>
      ) : result ? (
        <Card className="px-4 py-3.5">
          <p className="text-[14px] font-semibold text-muted">
            Registre alguns dias com as horas rodadas para ver os caminhos até a
            meta.
          </p>
        </Card>
      ) : null}

      <p className="px-1 text-[12px] font-semibold text-muted">
        Estimativa baseada no seu histórico, não é garantia de ganho.
      </p>
    </Screen>
  );
}

function PathRow({
  title,
  note,
  path,
  highlight = false,
}: {
  title: string;
  note: string;
  path: Path;
  highlight?: boolean;
}) {
  const hours = formatHoursFromDecimal(path.hoursPerDay);
  return (
    <li className="flex min-h-12 items-center justify-between gap-3 border-t border-divider py-1">
      <div>
        <div className="text-[15px] font-bold">{title}</div>
        <div className="text-[12px] font-semibold text-muted">
          {path.highLoad ? "carga alta: dá para fazer melhor" : note}
        </div>
      </div>
      <span
        className={cn(
          "font-display text-[17px] font-extrabold whitespace-nowrap",
          highlight && !path.highLoad && "rounded-[10px] bg-lime px-2.5 py-1",
        )}
      >
        {hours} por dia
      </span>
    </li>
  );
}
