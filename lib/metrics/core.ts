/**
 * Core money math for a set of days. Pure functions, integer cents.
 * CLAUDE.md › Regras de cálculo:
 *   net ("Sobrou no bolso") = gross − platformFee − expensesTotal
 *   per-hour / per-km metrics are omitted (null) when hours / km are missing.
 */
import { daysInMonth, type LocalDate } from "../dates";
import { divideRound, sumCents, type Cents } from "../money";
import type {
  DayData,
  Earning,
  Expense,
  PlatformSetting,
  Source,
} from "./types";

export function grossCents(earnings: readonly Earning[]): Cents {
  return sumCents(earnings.map((e) => e.amountCents));
}

export function expensesCents(expenses: readonly Expense[]): Cents {
  return sumCents(expenses.map((e) => e.amountCents));
}

function sameApp(
  setting: PlatformSetting,
  source: Source,
  label: string | null,
): boolean {
  if (setting.source !== source) return false;
  if (source !== "other") return true;
  return (
    (setting.label ?? "").trim().toLocaleLowerCase("pt-BR") ===
    (label ?? "").trim().toLocaleLowerCase("pt-BR")
  );
}

/** Percentage fee over each app's earnings (only apps set to "percent"). */
export function percentFeeCents(
  earnings: readonly Earning[],
  settings: readonly PlatformSetting[],
): Cents {
  let total = 0;
  for (const e of earnings) {
    const s = settings.find(
      (x) => x.mode === "percent" && sameApp(x, e.source, e.label),
    );
    if (s?.percent) total += Math.round((e.amountCents * s.percent) / 100);
  }
  return total;
}

function periodLength(
  period: PlatformSetting["passPeriod"],
  date: LocalDate,
): number {
  if (period === "week") return 7;
  if (period === "month") return daysInMonth(date);
  return 1;
}

/**
 * Pass/subscription cost spread per calendar day ("passe rateado por dia"),
 * summed over the given dates and rounded once.
 */
export function passFeeCents(
  settings: readonly PlatformSetting[],
  dates: readonly LocalDate[],
): Cents {
  let total = 0;
  for (const s of settings) {
    if (s.mode !== "pass" || !s.passCents) continue;
    for (const d of dates) total += s.passCents / periodLength(s.passPeriod, d);
  }
  return Math.round(total);
}

/** Cents per hour (rounded), or null without hours. */
export function perHourCents(
  cents: Cents,
  minutes: number | null | undefined,
): Cents | null {
  if (!minutes || minutes <= 0) return null;
  return divideRound(cents * 60, minutes);
}

/** Cents per km (rounded), or null without km. */
export function perKmCents(
  cents: Cents,
  km: number | null | undefined,
): Cents | null {
  if (!km || km <= 0) return null;
  return divideRound(cents, km);
}

export type Summary = {
  grossCents: Cents;
  platformFeeCents: Cents;
  expensesCents: Cents;
  netCents: Cents;
  /** Total minutes over days that informed hours (null if none did). */
  minutes: number | null;
  /** Total km over days that informed km (null if none did). */
  km: number | null;
  /** Gross per hour, using only days that informed hours. */
  grossPerHourCents: Cents | null;
  /** Gross per km, using only days that informed km. */
  grossPerKmCents: Cents | null;
  /** Net per hour, using only days that informed hours. */
  netPerHourCents: Cents | null;
  daysWorked: number;
};

/**
 * Summarizes days. `passDates` are the calendar days the pass cost is spread
 * over (for a single day, just that day).
 */
export function summarize(
  days: readonly DayData[],
  settings: readonly PlatformSetting[] = [],
  passDates: readonly LocalDate[] = [],
): Summary {
  const earnings = days.flatMap((d) => d.earnings);
  const gross = grossCents(earnings);
  const fee =
    percentFeeCents(earnings, settings) + passFeeCents(settings, passDates);
  const spent = expensesCents(days.flatMap((d) => d.expenses));
  const net = gross - fee - spent;

  const withHours = days.filter((d) => (d.minutes ?? 0) > 0);
  const withKm = days.filter((d) => (d.km ?? 0) > 0);
  const minutes = withHours.length
    ? sumCents(withHours.map((d) => d.minutes!))
    : null;
  const km = withKm.length ? sumCents(withKm.map((d) => d.km!)) : null;

  // Per-hour metrics only use the days that have hours, so missing hours
  // on some days never inflate the rate.
  const hoursSummary =
    withHours.length === days.length
      ? null
      : moneyOfSubset(withHours, settings, passDates);
  const grossForHours = hoursSummary ? hoursSummary.gross : gross;
  const netForHours = hoursSummary ? hoursSummary.net : net;
  const grossForKm =
    withKm.length === days.length
      ? gross
      : grossCents(withKm.flatMap((d) => d.earnings));

  return {
    grossCents: gross,
    platformFeeCents: fee,
    expensesCents: spent,
    netCents: net,
    minutes,
    km,
    grossPerHourCents: perHourCents(grossForHours, minutes),
    grossPerKmCents: perKmCents(grossForKm, km),
    netPerHourCents: perHourCents(netForHours, minutes),
    daysWorked: days.filter(
      (d) => !d.isDayOff && d.earnings.some((e) => e.amountCents > 0),
    ).length,
  };
}

/** Money totals of a subset of days; the pass counts only on the subset's own dates. */
function moneyOfSubset(
  subset: readonly DayData[],
  settings: readonly PlatformSetting[],
  passDates: readonly LocalDate[],
) {
  const earnings = subset.flatMap((d) => d.earnings);
  const gross = grossCents(earnings);
  const subsetDates = new Set(subset.map((d) => d.date));
  const dates = passDates.filter((d) => subsetDates.has(d));
  const fee =
    percentFeeCents(earnings, settings) + passFeeCents(settings, dates);
  const net = gross - fee - expensesCents(subset.flatMap((d) => d.expenses));
  return { gross, net };
}
