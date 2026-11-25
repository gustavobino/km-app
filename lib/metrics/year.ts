/**
 * "Resumo do ano": totals of a calendar year, month by month, best month and
 * each app's share of the earnings. Pure functions.
 */
import { monthRange, type DateRange, type LocalDate } from "../dates";
import type { Cents } from "../money";
import type { Summary } from "./core";
import { summarizeRange } from "./period";
import type { DayData, PlatformSetting, Source } from "./types";

export type YearMonth = {
  /** First day of the month ("2026-03-01"). */
  start: LocalDate;
  netCents: Cents;
  grossCents: Cents;
  daysWorked: number;
  /** After today: not lived yet. */
  future: boolean;
};

export type YearApp = {
  key: string;
  source: Source;
  label: string | null;
  cents: Cents;
  share: number;
};

export type YearSummary = {
  year: number;
  range: DateRange;
  summary: Summary;
  months: YearMonth[];
  /** Month with the most left in the pocket (null without worked days). */
  best: YearMonth | null;
  /** Average left in the pocket per worked day. */
  netPerDayCents: Cents | null;
  apps: YearApp[];
};

export function yearRange(year: number): DateRange {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function yearSummary(
  days: readonly DayData[],
  year: number,
  settings: readonly PlatformSetting[],
  today: LocalDate,
): YearSummary {
  const range = yearRange(year);
  const summary = summarizeRange(days, range, settings, today);
  const months: YearMonth[] = [];
  for (let m = 1; m <= 12; m++) {
    const start = `${year}-${String(m).padStart(2, "0")}-01`;
    const s = summarizeRange(days, monthRange(start), settings, today);
    months.push({
      start,
      netCents: s.netCents,
      grossCents: s.grossCents,
      daysWorked: s.daysWorked,
      future: start > today,
    });
  }
  const worked = months.filter((m) => m.daysWorked > 0);
  const best =
    worked.length > 0
      ? worked.reduce((a, b) => (b.netCents > a.netCents ? b : a))
      : null;

  const totals = new Map<string, YearApp>();
  for (const d of days) {
    if (d.date < range.start || d.date > range.end) continue;
    for (const e of d.earnings) {
      const label = e.source === "other" ? e.label?.trim() || null : null;
      const key = `${e.source}:${(label ?? "").toLocaleLowerCase("pt-BR")}`;
      const t = totals.get(key) ?? {
        key,
        source: e.source,
        label,
        cents: 0,
        share: 0,
      };
      t.cents += e.amountCents;
      totals.set(key, t);
    }
  }
  const gross = [...totals.values()].reduce((a, t) => a + t.cents, 0);
  const apps = [...totals.values()]
    .filter((t) => t.cents > 0)
    .map((t) => ({ ...t, share: t.cents / gross }))
    .sort((a, b) => b.cents - a.cents);

  return {
    year,
    range,
    summary,
    months,
    best,
    netPerDayCents:
      summary.daysWorked > 0
        ? Math.round(summary.netCents / summary.daysWorked)
        : null,
    apps,
  };
}
