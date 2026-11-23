"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import { LinkButton } from "@/components/ui/Button";
import { CapsLabel, Card, HeroCard } from "@/components/ui/Card";
import { DayBars } from "@/components/ui/DayBars";
import {
  ArrowRightIcon,
  GearIcon,
  PlusIcon,
  TriangleIcon,
} from "@/components/ui/icons";
import { HeroMoney } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, Skeleton } from "@/components/ui/States";
import {
  addDays,
  formatLongDate,
  formatMonthYear,
  formatRange,
  monthRange,
  today,
  type LocalDate,
} from "@/lib/dates";
import { appLabel } from "@/lib/day/form";
import { localDb } from "@/lib/local/db";
import { listLocalDays } from "@/lib/local/days";
import {
  bars,
  comparableRange,
  compareApps,
  monthGoal,
  periodRange,
  summarizeRange,
  variation,
  type AppComparison,
  type GoalProgress,
  type Period,
} from "@/lib/metrics/period";
import type { PlatformSetting } from "@/lib/metrics/types";
import { formatBRL } from "@/lib/money";
import { formatHoursDecimal, formatKm } from "@/lib/units";

type Props = {
  userId: string;
  platformSettings: PlatformSetting[];
  monthlyGoalCents: number | null;
};

const PERIOD_KEY = "kmplus:painel-periodo";
const PERIODS = [
  { value: "day", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
] as const;

const HERO_LABEL: Record<Period, string> = {
  day: "Sobrou no bolso hoje",
  week: "Sobrou no bolso na semana",
  month: "Sobrou no bolso no mês",
};
const PREVIOUS_LABEL: Record<Period, string> = {
  day: "que ontem",
  week: "que no mesmo trecho da semana passada",
  month: "que no mesmo trecho do mês passado",
};

function readPeriod(): Period {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    if (v === "day" || v === "week" || v === "month") return v;
  } catch {
    // Storage blocked: use the default.
  }
  return "week";
}

/** Painel: rendered only in the browser (data lives in IndexedDB). */
export function Dashboard({
  userId,
  platformSettings,
  monthlyGoalCents,
}: Props) {
  const [todayDate] = useState<LocalDate>(() => today());
  const [period, setPeriod] = useState<Period>(readPeriod);

  // Enough history for every period and its comparison: from the start of last month.
  const loadFrom = monthRange(addDays(monthRange(todayDate).start, -1)).start;
  const days = useLiveQuery(
    () =>
      listLocalDays(localDb(), userId, {
        start: loadFrom,
        end: monthRange(todayDate).end,
      }),
    [userId, loadFrom, todayDate],
  );
  const hasAnyDay = useLiveQuery(
    () => localDb().days.where("userId").equals(userId).count(),
    [userId],
  );

  const data = useMemo(() => {
    if (!days) return null;
    const range = periodRange(period, todayDate);
    const current = summarizeRange(days, range, platformSettings, todayDate);
    const previous = summarizeRange(
      days,
      comparableRange(period, range, todayDate),
      platformSettings,
      todayDate,
    );
    const month =
      period === "month"
        ? current
        : summarizeRange(
            days,
            monthRange(todayDate),
            platformSettings,
            todayDate,
          );
    const inRange = days.filter(
      (d) => d.date >= range.start && d.date <= range.end,
    );
    return {
      range,
      current,
      change: variation(current.netCents, previous.netCents),
      bars: bars(period, range, days, platformSettings, todayDate),
      apps: compareApps(inRange),
      goal: monthGoal(month.netCents, monthlyGoalCents, todayDate),
    };
  }, [days, period, todayDate, platformSettings, monthlyGoalCents]);

  const caption =
    period === "day"
      ? formatLongDate(todayDate)
      : period === "week"
        ? formatRange(periodRange("week", todayDate))
        : formatMonthYear(todayDate);

  const header = (
    <ScreenHeader
      title="Painel"
      caption={caption}
      trailing={
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className="-mr-2.5 flex size-touch items-center justify-center"
        >
          <GearIcon />
        </Link>
      }
    />
  );

  if (!data || hasAnyDay === undefined) {
    return (
      <Screen>
        {header}
        <div aria-busy="true" className="flex flex-col gap-gap-card">
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-13" />
          <Skeleton className="h-64 rounded-hero" />
          <Skeleton className="h-24" />
        </div>
      </Screen>
    );
  }

  if (hasAnyDay === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={<PlusIcon />}
          title="Registre seu primeiro dia para ver o painel"
          description="Leva uns 20 segundos. Só o ganho é obrigatório."
          action={
            <LinkButton href="/registrar" block>
              Registrar o dia
            </LinkButton>
          }
        />
      </Screen>
    );
  }

  const { current, change } = data;
  const best = data.bars.find((b) => b.best);

  return (
    <Screen>
      {header}
      <Segmented
        label="Período"
        options={PERIODS}
        value={period}
        onChange={(p) => {
          setPeriod(p);
          try {
            localStorage.setItem(PERIOD_KEY, p);
          } catch {
            // ignore
          }
        }}
      />

      <HeroCard className="px-5 pt-4.5 pb-1">
        <div className="flex items-center justify-between gap-2">
          <CapsLabel as="h2" onLime className="font-extrabold">
            {HERO_LABEL[period]}
          </CapsLabel>
          {change !== null ? (
            <VariationBadge
              change={change}
              previousLabel={PREVIOUS_LABEL[period]}
            />
          ) : null}
        </div>
        <HeroMoney value={current.netCents} className="mt-1.5" />
        <p className="mt-1.5 text-sm font-semibold text-lime-text">
          Ganhos {formatBRL(current.grossCents)} · gastos{" "}
          {formatBRL(current.expensesCents)}
          {current.platformFeeCents > 0
            ? ` · taxas ${formatBRL(current.platformFeeCents)}`
            : ""}
        </p>
        {data.bars.length > 0 ? (
          <DayBars
            className="mt-3"
            bars={data.bars.map((b) => ({
              key: b.key,
              label: b.label,
              value: Math.max(0, b.netCents),
              best: b.best,
            }))}
            label={
              best
                ? `Quanto sobrou por ${period === "week" ? "dia" : "semana"}. O melhor foi ${best.longLabel}, com ${formatBRL(best.netCents, { cents: false })}.`
                : `Quanto sobrou por ${period === "week" ? "dia" : "semana"}: nada registrado ainda.`
            }
          />
        ) : null}
        <Link
          href="/painel/lucro"
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

      <RateCards
        minutes={current.minutes}
        km={current.km}
        perHour={current.grossPerHourCents}
        perKm={current.grossPerKmCents}
      />
      {data.apps ? <AppsCard comparison={data.apps} /> : null}
      {data.goal ? <GoalCard goal={data.goal} /> : null}
    </Screen>
  );
}

function VariationBadge({
  change,
  previousLabel,
}: {
  change: number;
  previousLabel: string;
}) {
  const pct = Math.round(Math.abs(change) * 100);
  const same = pct === 0;
  const up = change > 0;
  const spoken = same
    ? `Igual ${previousLabel.replace(/^que /, "a ")}`
    : `${pct}% a ${up ? "mais" : "menos"} ${previousLabel}`;
  return (
    <span
      role="img"
      aria-label={spoken}
      className="flex h-7 flex-none items-center gap-1 rounded-[14px] bg-ink px-2.5 text-xs font-extrabold text-lime"
    >
      {same ? "=" : <TriangleIcon down={!up} />}
      {same ? "igual" : `${pct}%`}
    </span>
  );
}

function RateCards(props: {
  minutes: number | null;
  km: number | null;
  perHour: number | null;
  perKm: number | null;
}) {
  if (props.perHour == null && props.perKm == null) {
    return (
      <Card className="px-4 py-3">
        <p className="text-[14px] font-semibold text-muted">
          Informe horas e km ao registrar o dia para ver quanto você ganha por
          hora e por km.
        </p>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {props.perHour != null ? (
        <Card className="px-4 py-3">
          <h2 className="text-xs font-bold text-muted">Ganho por hora</h2>
          <div className="font-display text-[30px] leading-[1.1] font-extrabold">
            {formatBRL(props.perHour)}
          </div>
          <div className="text-xs font-semibold text-muted">
            em {formatHoursDecimal(props.minutes ?? 0)} h rodadas
          </div>
        </Card>
      ) : (
        <Hint text="Informe as horas para ver o ganho por hora." />
      )}
      {props.perKm != null ? (
        <Card className="px-4 py-3">
          <h2 className="text-xs font-bold text-muted">Ganho por km</h2>
          <div className="font-display text-[30px] leading-[1.1] font-extrabold">
            {formatBRL(props.perKm)}
          </div>
          <div className="text-xs font-semibold text-muted">
            em {formatKm(props.km ?? 0)} km rodados
          </div>
        </Card>
      ) : (
        <Hint text="Informe os km para ver o ganho por km." />
      )}
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <Card className="flex items-center px-4 py-3">
      <p className="text-[13px] font-semibold text-muted">{text}</p>
    </Card>
  );
}

function AppsCard({ comparison }: { comparison: NonNullable<AppComparison> }) {
  const { rows, mode } = comparison;
  const isUber99 =
    rows.length === 2 &&
    rows.every((r) => r.source === "uber" || r.source === "99");
  const title =
    mode === "perHour"
      ? isUber99
        ? "Uber × 99, por hora"
        : "Apps, por hora"
      : "Quanto veio de cada app";
  const max = Math.max(...rows.map((r) => r.cents), 1);
  return (
    <Card className="px-4 pt-3.5 pb-4">
      <CapsLabel as="h2" className="mb-2.5">
        {title}
      </CapsLabel>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const name = appLabel(r.source, r.label);
          const value =
            mode === "perHour"
              ? formatBRL(r.cents)
              : `${Math.round(r.share * 100)}%`;
          return (
            <li key={r.key} className="flex items-center gap-2.5">
              <span className="w-16 truncate text-sm font-extrabold">
                {name}
              </span>
              <div
                aria-hidden="true"
                className="h-3 flex-1 rounded-bar bg-track"
              >
                <div
                  className={
                    i === 0
                      ? "h-3 rounded-bar bg-ink"
                      : "h-3 rounded-bar bg-grey-bar"
                  }
                  style={{ width: `${Math.max(4, (r.cents / max) * 100)}%` }}
                />
              </div>
              <span className="w-18 text-right text-sm font-extrabold">
                {value}
                <span className="sr-only">
                  {mode === "perHour"
                    ? " por hora"
                    : ` do ganho, ${formatBRL(r.cents)}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {mode === "share" ? (
        <p className="mt-3 text-[13px] font-semibold text-muted">
          Para comparar por hora, use “Dividir horas entre apps” ao registrar.
        </p>
      ) : null}
    </Card>
  );
}

function GoalCard({ goal }: { goal: GoalProgress }) {
  const pct = Math.floor(goal.ratio * 100);
  return (
    <HeroCard radius="hero-md" className="px-4 pt-3.5 pb-4">
      <div className="mb-2.5 flex items-baseline justify-between">
        <CapsLabel as="h2" onLime>
          Meta do mês · {formatBRL(goal.goalCents, { cents: false })}
        </CapsLabel>
        <span className="font-display text-[26px] font-extrabold">{pct}%</span>
      </div>
      <ProgressBar ratio={goal.ratio} onLime label={`${pct}% da meta do mês`} />
      <p className="mt-2.5 text-[13px] font-bold text-lime-text">
        {goal.reached
          ? `Meta batida! Você passou da meta em ${formatBRL(goal.netCents - goal.goalCents, { cents: false })}.`
          : `Faltam ${formatBRL(goal.remainingCents, { cents: false })} · cerca de ${formatBRL(goal.perDayCents, { cents: false })} por dia ${goal.daysLeft === 1 ? "hoje, último dia do mês" : `nos ${goal.daysLeft} dias que restam`}`}
      </p>
    </HeroCard>
  );
}
