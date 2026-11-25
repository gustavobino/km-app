/**
 * Period metrics for the Painel: ranges, comparison with the previous period,
 * bars per day/week, app comparison and the month goal. Pure functions.
 */
import {
  addDays,
  daysBetweenInclusive,
  daysInMonth,
  eachDay,
  formatWeekdayLong,
  formatWeekdayShort,
  monthRange,
  remainingDaysInMonth,
  weekRange,
  type DateRange,
  type LocalDate,
} from "../dates";
import { divideRound, type Cents } from "../money";
import { summarize, type Summary } from "./core";
import type { DayData, PlatformSetting, Source } from "./types";

export type Period = "day" | "week" | "month";

export function periodRange(period: Period, today: LocalDate): DateRange {
  if (period === "day") return { start: today, end: today };
  if (period === "week") return weekRange(today);
  return monthRange(today);
}

/**
 * The part of the period that has already happened (start → today, never
 * past the end). Passes are only charged for these days.
 */
export function elapsedRange(range: DateRange, today: LocalDate): DateRange {
  const end = today < range.end ? today : range.end;
  return { start: range.start, end: end < range.start ? range.start : end };
}

/**
 * The same stretch of the previous period, for a fair comparison: on a
 * Wednesday the week is compared with last Monday→Wednesday, not the whole
 * previous week. Months are clamped (31 March ↔ 28 February).
 */
export function comparableRange(
  period: Period,
  range: DateRange,
  today: LocalDate,
): DateRange {
  const elapsed = elapsedRange(range, today);
  if (period === "day")
    return { start: addDays(range.start, -1), end: addDays(range.start, -1) };
  if (period === "week") {
    return { start: addDays(elapsed.start, -7), end: addDays(elapsed.end, -7) };
  }
  const prevStart = monthRange(addDays(range.start, -1)).start;
  const elapsedDays = daysBetweenInclusive(elapsed.start, elapsed.end);
  const prevLen = daysInMonth(prevStart);
  return {
    start: prevStart,
    end: addDays(prevStart, Math.min(elapsedDays, prevLen) - 1),
  };
}

function within(days: readonly DayData[], range: DateRange) {
  return days.filter((d) => d.date >= range.start && d.date <= range.end);
}

/** Summary of the days inside a range; passes are spread over the elapsed days only. */
export function summarizeRange(
  days: readonly DayData[],
  range: DateRange,
  settings: readonly PlatformSetting[],
  today: LocalDate,
): Summary {
  const passDates =
    range.start > today ? [] : eachDay(elapsedRange(range, today));
  return summarize(within(days, range), settings, passDates);
}

/** Relative change (0.08 = +8%), or null when there is nothing to compare with. */
export function variation(current: Cents, previous: Cents): number | null {
  if (previous <= 0) return null;
  return current / previous - 1;
}

export type Bar = {
  key: string;
  label: string;
  longLabel: string;
  netCents: Cents;
  best: boolean;
};

/** Week: one bar per day (Seg…Dom). Month: one bar per week (S1…S5). Day: none. */
export function bars(
  period: Period,
  range: DateRange,
  days: readonly DayData[],
  settings: readonly PlatformSetting[],
  today: LocalDate,
): Bar[] {
  let out: Omit<Bar, "best">[] = [];
  if (period === "week") {
    out = eachDay(range).map((d) => ({
      key: d,
      label: formatWeekdayShort(d),
      longLabel: formatWeekdayLong(d).toLowerCase(),
      netCents:
        d > today
          ? 0
          : summarizeRange(days, { start: d, end: d }, settings, today)
              .netCents,
    }));
  } else if (period === "month") {
    let start = range.start;
    let n = 1;
    while (start <= range.end) {
      const week = weekRange(start);
      const end = week.end < range.end ? week.end : range.end;
      out.push({
        key: start,
        label: `S${n}`,
        longLabel: `${n}ª semana`,
        netCents:
          start > today
            ? 0
            : summarizeRange(days, { start, end }, settings, today).netCents,
      });
      start = addDays(end, 1);
      n += 1;
    }
  }
  const best = out.reduce<number>(
    (acc, b, i) => (b.netCents > (out[acc]?.netCents ?? 0) ? i : acc),
    -1,
  );
  return out.map((b, i) => ({ ...b, best: i === best }));
}

export type AppRow = {
  key: string;
  source: Source;
  label: string | null;
  cents: Cents;
  share: number;
};

export type AppComparison =
  | { mode: "perHour"; rows: AppRow[] }
  | { mode: "share"; rows: AppRow[] }
  | null;

function appKey(source: Source, label: string | null) {
  return source === "other"
    ? `other:${(label ?? "").trim().toLocaleLowerCase("pt-BR")}`
    : source;
}

/**
 * Uber × 99 (and other apps). Per hour only with hours informed per app
 * (earnings.minutes) for at least two apps; otherwise each app's share of the
 * earnings (R$ and %). Null with fewer than two apps.
 */
export function compareApps(days: readonly DayData[]): AppComparison {
  const totals = new Map<
    string,
    {
      source: Source;
      label: string | null;
      cents: number;
      hCents: number;
      minutes: number;
    }
  >();
  for (const e of days.flatMap((d) => d.earnings)) {
    const key = appKey(e.source, e.label);
    const t = totals.get(key) ?? {
      source: e.source,
      label: e.label,
      cents: 0,
      hCents: 0,
      minutes: 0,
    };
    t.cents += e.amountCents;
    if (e.minutes && e.minutes > 0) {
      t.hCents += e.amountCents;
      t.minutes += e.minutes;
    }
    totals.set(key, t);
  }
  const apps = [...totals.entries()].filter(
    ([, t]) => t.cents > 0 || t.minutes > 0,
  );
  if (apps.length < 2) return null;

  const withHours = apps.filter(([, t]) => t.minutes > 0);
  if (withHours.length >= 2) {
    const rows = withHours.map(([key, t]) => ({
      key,
      source: t.source,
      label: t.label,
      cents: divideRound(t.hCents * 60, t.minutes)!,
      share: 0,
    }));
    return { mode: "perHour", rows: sortRows(rows) };
  }

  // Two or more apps and fewer than two with hours: at least one has money, so total > 0.
  const total = apps.reduce((a, [, t]) => a + t.cents, 0);
  const rows = apps.map(([key, t]) => ({
    key,
    source: t.source,
    label: t.label,
    cents: t.cents,
    share: t.cents / total,
  }));
  return { mode: "share", rows: sortRows(rows) };
}

function sortRows(rows: AppRow[]): AppRow[] {
  return rows.sort((a, b) => b.cents - a.cents);
}

export type GoalProgress = {
  goalCents: Cents;
  netCents: Cents;
  ratio: number;
  reached: boolean;
  remainingCents: Cents;
  daysLeft: number;
  perDayCents: Cents;
};

/** "Faltam R$ X · cerca de R$ Y por dia nos N dias restantes" (days left include today). */
export function monthGoal(
  netMonthCents: Cents,
  goalCents: Cents | null,
  today: LocalDate,
): GoalProgress | null {
  if (!goalCents || goalCents <= 0) return null;
  const remaining = Math.max(0, goalCents - netMonthCents);
  const daysLeft = remainingDaysInMonth(today);
  return {
    goalCents,
    netCents: netMonthCents,
    ratio: Math.max(0, netMonthCents / goalCents),
    reached: remaining === 0,
    remainingCents: remaining,
    daysLeft,
    perDayCents: divideRound(remaining, daysLeft)!,
  };
}

export type TodayGoal = {
  /** What today should leave in the pocket to keep the month goal on track. */
  targetCents: Cents;
  todayNetCents: Cents;
  /** Still missing today (0 once reached). */
  missingCents: Cents;
  reachedToday: boolean;
  /** The month goal was already reached before today: anything now is extra. */
  monthReached: boolean;
  ratio: number;
  /** The driver set today's goal by hand (instead of the one from the month goal). */
  custom: boolean;
};

/**
 * "Meta de hoje": the rest of the month goal (before today) spread over the
 * days left including today, compared with what today already left. A goal
 * set by hand for today (`overrideCents`) replaces it.
 */
export function todayGoal(
  goalCents: Cents | null,
  netBeforeTodayCents: Cents,
  todayNetCents: Cents,
  today: LocalDate,
  overrideCents: Cents | null = null,
): TodayGoal | null {
  const custom = overrideCents != null && overrideCents > 0;
  if (!custom && (!goalCents || goalCents <= 0)) return null;
  const remainingMonth = custom
    ? overrideCents
    : Math.max(0, goalCents! - netBeforeTodayCents);
  if (remainingMonth === 0)
    return {
      targetCents: 0,
      todayNetCents,
      missingCents: 0,
      reachedToday: true,
      monthReached: true,
      ratio: 1,
      custom: false,
    };
  const target = custom
    ? overrideCents
    : divideRound(remainingMonth, remainingDaysInMonth(today))!;
  const missing = Math.max(0, target - todayNetCents);
  return {
    targetCents: target,
    todayNetCents,
    missingCents: missing,
    reachedToday: missing === 0,
    monthReached: false,
    ratio: Math.max(0, Math.min(1, todayNetCents / target)),
    custom,
  };
}
