/**
 * "Relatório de ganhos": month-by-month totals for a chosen period, to share
 * as a PDF (e.g. to rent a home). Values are what the driver registered:
 * the report always says so. Pure functions.
 */
import { formatMonthName, monthRange, type LocalDate } from "../dates";
import { appLabel } from "../day/form";
import type { Cents } from "../money";
import { summarizeRange } from "../metrics/period";
import type { DayData, PlatformSetting } from "../metrics/types";

export type ReportPeriod = "3m" | "6m" | "12m" | "year";

export const REPORT_PERIODS: ReadonlyArray<{
  value: ReportPeriod;
  label: string;
}> = [
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
  { value: "year", label: "Este ano" },
];

export type ReportMonth = {
  start: LocalDate;
  /** "Outubro de 2026". */
  label: string;
  /** The month is still running: totals until this day. */
  until: LocalDate | null;
  daysWorked: number;
  grossCents: Cents;
  /** Expenses + app fees. */
  costsCents: Cents;
  netCents: Cents;
};

export type EarningsReport = {
  period: ReportPeriod;
  /** "Agosto a outubro de 2026". */
  periodLabel: string;
  months: ReportMonth[];
  total: Omit<ReportMonth, "start" | "label" | "until">;
  /** Gross per month, over every month of the period (also the empty ones). */
  averageGrossCents: Cents;
  averageNetCents: Cents;
  apps: Array<{ name: string; cents: Cents; share: number }>;
  hasData: boolean;
};

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function shiftMonth(start: LocalDate, delta: number): LocalDate {
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7)) - 1 + delta;
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/** Month starts of the period: N complete months before this one, or this year so far. */
export function reportMonths(
  period: ReportPeriod,
  today: LocalDate,
): LocalDate[] {
  const current = monthRange(today).start;
  if (period === "year") {
    const count = Number(today.slice(5, 7));
    return Array.from({ length: count }, (_, i) =>
      shiftMonth(`${today.slice(0, 4)}-01-01`, i),
    );
  }
  const n = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  return Array.from({ length: n }, (_, i) => shiftMonth(current, i - n));
}

function monthLabel(start: LocalDate): string {
  return `${cap(formatMonthName(start))} de ${start.slice(0, 4)}`;
}

export function periodLabel(months: readonly LocalDate[]): string {
  const first = months[0]!;
  const last = months[months.length - 1]!;
  if (first === last) return monthLabel(first);
  if (first.slice(0, 4) === last.slice(0, 4))
    return `${cap(formatMonthName(first))} a ${formatMonthName(last)} de ${last.slice(0, 4)}`;
  return `${monthLabel(first)} a ${formatMonthName(last)} de ${last.slice(0, 4)}`;
}

export function buildEarningsReport(
  days: readonly DayData[],
  period: ReportPeriod,
  settings: readonly PlatformSetting[],
  today: LocalDate,
): EarningsReport {
  const starts = reportMonths(period, today);
  const months: ReportMonth[] = starts.map((start) => {
    const range = monthRange(start);
    const s = summarizeRange(days, range, settings, today);
    return {
      start,
      label: monthLabel(start),
      until: today >= range.start && today < range.end ? today : null,
      daysWorked: s.daysWorked,
      grossCents: s.grossCents,
      costsCents: s.grossCents - s.netCents,
      netCents: s.netCents,
    };
  });
  const sum = (k: "daysWorked" | "grossCents" | "costsCents" | "netCents") =>
    months.reduce((a, m) => a + m[k], 0);
  const total = {
    daysWorked: sum("daysWorked"),
    grossCents: sum("grossCents"),
    costsCents: sum("costsCents"),
    netCents: sum("netCents"),
  };

  const first = starts[0]!;
  const last = monthRange(starts[starts.length - 1]!).end;
  const byApp = new Map<string, { name: string; cents: number }>();
  for (const d of days) {
    if (d.date < first || d.date > last || d.date > today) continue;
    for (const e of d.earnings) {
      const name = appLabel(e.source, e.label);
      const key = name.toLocaleLowerCase("pt-BR");
      const t = byApp.get(key) ?? { name, cents: 0 };
      t.cents += e.amountCents;
      byApp.set(key, t);
    }
  }
  const apps = [...byApp.values()]
    .filter((a) => a.cents > 0)
    .sort((a, b) => b.cents - a.cents)
    .map((a) => ({ ...a, share: a.cents / total.grossCents }));

  return {
    period,
    periodLabel: periodLabel(starts),
    months,
    total,
    averageGrossCents: Math.round(total.grossCents / months.length),
    averageNetCents: Math.round(total.netCents / months.length),
    apps,
    hasData: total.grossCents > 0,
  };
}
