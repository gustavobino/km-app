/**
 * Goal simulator (CLAUDE.md › Simulador). Pure functions. Always an estimate.
 *   perDay   = target / daysPerMonth
 *   perHour  = target / (hoursPerDay × daysPerMonth)
 *   aboveRate = perHour / baseNetPerHour − 1
 * Paths (hours per day): only more hours; +20% per hour; +20% and +2 days;
 * and the "halfway" target = (current monthly + target) / 2.
 */
import { addDays, type LocalDate } from "../dates";
import { summarize } from "../metrics/core";
import type { DayData, PlatformSetting } from "../metrics/types";
import type { Cents } from "../money";

export const SIMULATOR = {
  /** History window for the base rate. */
  windowDays: 90,
  /** Fewer days with hours than this → the base is flagged as thin. */
  minDaysWithHours: 7,
  /** Path 2 and 3: earn this much more per hour. */
  rateBoost: 0.2,
  /** Path 3: drive this many more days per month. */
  extraDays: 2,
  /** Any path above this many hours per day gets the "carga alta" note. */
  highLoadHours: 12,
} as const;

export type Base = {
  /** Net cents per hour over days with hours in the window (null without any). */
  netPerHourCents: number | null;
  daysWithHours: number;
  /** Fewer than SIMULATOR.minDaysWithHours days with hours. */
  thin: boolean;
  /** Average hours per day driven (with hours) in the window, null without history. */
  avgHoursPerDay: number | null;
};

/** Base rate from the last 90 days, only days that informed hours. */
export function historicalBase(
  days: readonly DayData[],
  settings: readonly PlatformSetting[],
  today: LocalDate,
  windowDays: number = SIMULATOR.windowDays,
): Base {
  const start = addDays(today, -(windowDays - 1));
  const withHours = days.filter(
    (d) =>
      d.date >= start && d.date <= today && !d.isDayOff && (d.minutes ?? 0) > 0,
  );
  if (withHours.length === 0) {
    return {
      netPerHourCents: null,
      daysWithHours: 0,
      thin: true,
      avgHoursPerDay: null,
    };
  }
  // Passes are charged on the same days, so the rate stays per worked hour.
  const s = summarize(
    withHours,
    settings,
    withHours.map((d) => d.date),
  );
  const minutes = s.minutes!;
  return {
    netPerHourCents: (s.netCents * 60) / minutes,
    daysWithHours: withHours.length,
    thin: withHours.length < SIMULATOR.minDaysWithHours,
    avgHoursPerDay: minutes / 60 / withHours.length,
  };
}

export type SimulatorInput = {
  targetCents: Cents;
  hoursPerDay: number;
  daysPerMonth: number;
  /** Net cents per hour (from historicalBase). */
  baseNetPerHourCents: number | null;
  /** What the driver nets per month today (for the halfway path). */
  currentMonthlyCents: Cents | null;
};

export type Path = { hoursPerDay: number; highLoad: boolean };

export type SimulatorResult = {
  perDayCents: Cents;
  perHourCents: Cents;
  /** perHour / base − 1 (0.6667 = 67% above), null without a base. */
  aboveRate: number | null;
  paths: {
    onlyMoreHours: Path;
    betterRate: Path;
    betterRateMoreDays: Path;
    halfway: (Path & { targetCents: Cents }) | null;
  } | null;
  anyHighLoad: boolean;
};

function path(hours: number): Path {
  return { hoursPerDay: hours, highLoad: hours > SIMULATOR.highLoadHours };
}

/** Null when the inputs cannot produce a result (no target, hours or days). */
export function simulate(input: SimulatorInput): SimulatorResult | null {
  const { targetCents: target, hoursPerDay, daysPerMonth } = input;
  if (!(target > 0) || !(hoursPerDay > 0) || !(daysPerMonth > 0)) return null;

  const perDay = target / daysPerMonth;
  const perHour = target / (hoursPerDay * daysPerMonth);
  const base = input.baseNetPerHourCents;

  if (base == null || base <= 0) {
    return {
      perDayCents: Math.round(perDay),
      perHourCents: Math.round(perHour),
      aboveRate: null,
      paths: null,
      anyHighLoad: false,
    };
  }

  const boosted = base * (1 + SIMULATOR.rateBoost);
  const onlyMoreHours = path(target / base / daysPerMonth);
  const betterRate = path(target / boosted / daysPerMonth);
  const betterRateMoreDays = path(
    target / boosted / (daysPerMonth + SIMULATOR.extraDays),
  );
  let halfway: (Path & { targetCents: Cents }) | null = null;
  if (input.currentMonthlyCents != null && input.currentMonthlyCents < target) {
    const mid = Math.round((input.currentMonthlyCents + target) / 2);
    halfway = { ...path(mid / base / daysPerMonth), targetCents: mid };
  }

  const all = [
    onlyMoreHours,
    betterRate,
    betterRateMoreDays,
    ...(halfway ? [halfway] : []),
  ];
  return {
    perDayCents: Math.round(perDay),
    perHourCents: Math.round(perHour),
    aboveRate: perHour / base - 1,
    paths: { onlyMoreHours, betterRate, betterRateMoreDays, halfway },
    anyHighLoad: all.some((p) => p.highLoad),
  };
}

/** Today's monthly net at the current pace: base × hours per day × days per month. */
export function currentMonthly(
  baseNetPerHourCents: number | null,
  hoursPerDay: number,
  daysPerMonth: number,
): Cents | null {
  if (baseNetPerHourCents == null || !(hoursPerDay > 0) || !(daysPerMonth > 0))
    return null;
  return Math.round(baseNetPerHourCents * hoursPerDay * daysPerMonth);
}
