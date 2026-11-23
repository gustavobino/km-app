/**
 * Insights (CLAUDE.md › Insights): simple rules, no AI. Each rule has an
 * explicit threshold (INSIGHTS) and its own tests. Pure functions.
 */
import {
  addDays,
  daysBetweenInclusive,
  formatWeekdayLong,
  weekdayIndex,
  weekRange,
  type LocalDate,
} from "../dates";
import { appLabel } from "../day/form";
import { summarize } from "../metrics/core";
import {
  comparableRange,
  compareApps,
  summarizeRange,
  variation,
} from "../metrics/period";
import type { DayData, PlatformSetting, Shift } from "../metrics/types";
import { formatBRL, type Cents } from "../money";
import { formatKm } from "../units";

export const INSIGHTS = {
  /** Rule 1: history span and samples. */
  bestMinWeeks: 3,
  bestMinSamples: 2,
  /** Rule 1: minimum advantage in net per hour. */
  bestMinAdvantage: 0.15,
  /** Rule 3: warn when this share of the interval (or fewer km) is left. */
  maintenanceShare: 0.15,
  maintenanceKm: 800,
  /** Rule 5: warn when the last tank is this much worse than the 30-day average. */
  consumptionDrop: 0.1,
  consumptionWindowDays: 30,
  /** Rule 7: consecutive days driving. */
  restStreak: 6,
} as const;

export type InsightIcon = "clock" | "trend" | "wrench" | "shield" | "fuel";

export type Insight = {
  id: string;
  icon: InsightIcon;
  title: string;
  body: string;
};

const isDriven = (d: DayData) =>
  !d.isDayOff && d.earnings.some((e) => e.amountCents > 0);
const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** "Cerca de" percentages in steps of 5. */
const roughPct = (ratio: number) =>
  Math.max(5, Math.round((ratio * 100) / 5) * 5);

type Rate = { net: number; minutes: number; samples: number };

function netPerHourGroups<K>(
  days: readonly DayData[],
  settings: readonly PlatformSetting[],
  keysOf: (d: DayData) => K[],
): Map<K, Rate> {
  const groups = new Map<K, Rate>();
  for (const d of days) {
    if (!isDriven(d) || !d.minutes) continue;
    const net = summarize([d], settings, [d.date]).netCents;
    for (const k of keysOf(d)) {
      const g = groups.get(k) ?? { net: 0, minutes: 0, samples: 0 };
      g.net += net;
      g.minutes += d.minutes;
      g.samples += 1;
      groups.set(k, g);
    }
  }
  return groups;
}

function bestGroup<K>(
  groups: Map<K, Rate>,
): { key: K; advantage: number } | null {
  const eligible = [...groups.entries()].filter(
    ([, g]) => g.samples >= INSIGHTS.bestMinSamples,
  );
  if (eligible.length < 2) return null;
  const rate = (g: Rate) => g.net / g.minutes;
  const [bestKey, best] = eligible.reduce((a, b) =>
    rate(b[1]) > rate(a[1]) ? b : a,
  );
  const others = eligible.filter(([k]) => k !== bestKey);
  const othersRate =
    others.reduce((a, [, g]) => a + g.net, 0) /
    others.reduce((a, [, g]) => a + g.minutes, 0);
  if (othersRate <= 0) return null;
  const advantage = rate(best) / othersRate - 1;
  // Tiny tolerance so exactly 15% (in floating point) counts.
  return advantage >= INSIGHTS.bestMinAdvantage - 1e-9
    ? { key: bestKey, advantage }
    : null;
}

/** Has the driver registered for at least 3 weeks (first day with hours → today)? */
function enoughHistory(days: readonly DayData[], today: LocalDate): boolean {
  const first = days
    .filter((d) => isDriven(d) && d.minutes)
    .map((d) => d.date)
    .sort()[0];
  return (
    first != null &&
    daysBetweenInclusive(first, today) >= INSIGHTS.bestMinWeeks * 7
  );
}

const SHIFT_NAMES: Record<Shift, string> = {
  morning: "manhã",
  afternoon: "tarde",
  evening: "noite",
  night: "madrugada",
};

/** Rule 1: best weekday and best shift (net per hour). */
export function bestDayAndShift(
  days: readonly DayData[],
  settings: readonly PlatformSetting[],
  today: LocalDate,
): Insight[] {
  if (!enoughHistory(days, today)) return [];
  const out: Insight[] = [];
  const byDay = bestGroup(
    netPerHourGroups(days, settings, (d) => [weekdayIndex(d.date)]),
  );
  if (byDay) {
    const sample = days.find((d) => weekdayIndex(d.date) === byDay.key)!.date;
    out.push({
      id: "best-day",
      icon: "clock",
      title: `${formatWeekdayLong(sample)} rende mais`,
      body: `Cerca de ${roughPct(byDay.advantage)}% a mais por hora que nos outros dias.`,
    });
  }
  const byShift = bestGroup(
    netPerHourGroups(days, settings, (d) => d.shifts ?? []),
  );
  if (byShift) {
    out.push({
      id: "best-shift",
      icon: "clock",
      title: `${capitalize(`A ${SHIFT_NAMES[byShift.key]}`)} rende mais`,
      body: `Cerca de ${roughPct(byShift.advantage)}% a mais por hora que nos outros turnos.`,
    });
  }
  return out;
}

/** Rule 2: apps this week (per hour with hours per app, else share of earnings). */
export function appsInsight(
  days: readonly DayData[],
  today: LocalDate,
): Insight | null {
  const week = weekRange(today);
  const c = compareApps(
    days.filter((d) => d.date >= week.start && d.date <= today),
  );
  if (!c) return null;
  const [first, second] = c.rows as [(typeof c.rows)[0], (typeof c.rows)[0]];
  const a = appLabel(first.source, first.label);
  const b = appLabel(second.source, second.label);
  const article = (name: string) =>
    name === "Uber" ? "a Uber" : name === "99" ? "a 99" : name;
  if (c.mode === "perHour") {
    if (first.cents === second.cents) return null;
    return {
      id: "apps",
      icon: "trend",
      title: `${a} rendeu mais que ${article(b)}`,
      body: `${formatBRL(first.cents - second.cents)} a mais por hora nesta semana.`,
    };
  }
  return {
    id: "apps",
    icon: "trend",
    title: `${a} trouxe a maior parte`,
    body: `${Math.round(first.share * 100)}% dos seus ganhos nesta semana. Divida as horas entre apps para comparar por hora.`,
  };
}

export type MaintenanceItem = {
  id: string;
  name: string;
  intervalKm: number;
  lastDoneKm: number | null;
  lastDoneDate: LocalDate | null;
};

/** Latest odometer reading from fuel expenses (with its date). */
export function latestOdometer(
  days: readonly DayData[],
): { km: number; date: LocalDate } | null {
  let best: { km: number; date: LocalDate } | null = null;
  for (const d of days) {
    for (const x of d.expenses) {
      if (x.odometerKm != null && (!best || x.odometerKm > best.km))
        best = { km: x.odometerKm, date: d.date };
    }
  }
  return best;
}

/** km driven since the item was last done: odometer when possible, else the sum of daily km since that date. */
export function kmSince(
  item: MaintenanceItem,
  days: readonly DayData[],
): number | null {
  const odo = latestOdometer(days);
  if (odo && item.lastDoneKm != null && odo.km >= item.lastDoneKm)
    return odo.km - item.lastDoneKm;
  if (item.lastDoneDate) {
    return days
      .filter((d) => d.date > item.lastDoneDate!)
      .reduce((a, d) => a + (d.km ?? 0), 0);
  }
  return null;
}

/** Rule 3: maintenance due soon (≤ 15% of the interval or ≤ 800 km left). */
export function maintenanceInsights(
  items: readonly MaintenanceItem[],
  days: readonly DayData[],
): Insight[] {
  const out: Insight[] = [];
  for (const item of items) {
    const driven = kmSince(item, days);
    if (driven == null) continue;
    const left = item.intervalKm - driven;
    const near =
      left <= item.intervalKm * INSIGHTS.maintenanceShare ||
      left <= INSIGHTS.maintenanceKm;
    if (!near) continue;
    out.push({
      id: `maintenance-${item.id}`,
      icon: "wrench",
      title: `${item.name} chegando`,
      body:
        left > 0
          ? `Faltam cerca de ${formatKm(roundKm(left))} km para a próxima.`
          : `Já passou cerca de ${formatKm(roundKm(-left) || 50)} km do previsto. Vale agendar.`,
    });
  }
  return out;
}

const roundKm = (km: number) => Math.round(km / 50) * 50;

/** Rule 4: "separe cerca de R$ X por dia rodado" (only with vehicle mode on). */
export function reserveInsight(
  perDayDrivenCents: Cents | null,
  vehicleModeEnabled: boolean,
): Insight | null {
  if (!vehicleModeEnabled || !perDayDrivenCents || perDayDrivenCents <= 0)
    return null;
  return {
    id: "reserve",
    icon: "shield",
    title: "Reserva do carro",
    body: `Separe cerca de ${formatBRL(perDayDrivenCents, { cents: false })} por dia rodado e fique tranquilo.`,
  };
}

export type Fill = {
  date: LocalDate;
  odometerKm: number;
  liters: number;
  fullTank: boolean;
};

/** Fuel expenses with liters and odometer, in odometer order. */
export function fills(days: readonly DayData[]): Fill[] {
  return days
    .flatMap((d) =>
      d.expenses
        .filter(
          (x) => x.category === "fuel" && x.liters && x.odometerKm != null,
        )
        .map((x) => ({
          date: d.date,
          odometerKm: x.odometerKm!,
          liters: x.liters!,
          fullTank: Boolean(x.fullTank),
        })),
    )
    .sort((a, b) => a.odometerKm - b.odometerKm);
}

/**
 * Tank-to-tank km/l: between two full tanks, km driven ÷ liters put in after
 * the first one (including partial fills in between).
 */
export function tankToTank(
  list: readonly Fill[],
): Array<{ date: LocalDate; kmPerLiter: number }> {
  const out: Array<{ date: LocalDate; kmPerLiter: number }> = [];
  let start: Fill | null = null;
  let liters = 0;
  for (const f of list) {
    if (start) liters += f.liters;
    if (!f.fullTank) continue;
    if (start && f.odometerKm > start.odometerKm && liters > 0) {
      out.push({
        date: f.date,
        kmPerLiter: (f.odometerKm - start.odometerKm) / liters,
      });
    }
    start = f;
    liters = 0;
  }
  return out;
}

const kml = (v: number) => v.toFixed(1).replace(".", ",");

/** Rule 5: last tank more than 10% worse than the 30-day average of the previous tanks. */
export function consumptionInsight(
  days: readonly DayData[],
  today: LocalDate,
): Insight | null {
  const series = tankToTank(fills(days));
  if (series.length < 2) return null;
  const last = series[series.length - 1]!;
  const from = addDays(today, -(INSIGHTS.consumptionWindowDays - 1));
  const previous = series.slice(0, -1).filter((s) => s.date >= from);
  if (previous.length === 0) return null;
  const avg = previous.reduce((a, s) => a + s.kmPerLiter, 0) / previous.length;
  if (last.kmPerLiter >= avg * (1 - INSIGHTS.consumptionDrop) - 1e-9)
    return null;
  return {
    id: "consumption",
    icon: "fuel",
    title: "O consumo piorou",
    body: `${kml(last.kmPerLiter)} km/l no último tanque, contra ${kml(avg)} km/l na média recente. Vale olhar pneus e manutenção.`,
  };
}

/** Rule 6: week summary built from a sentence template. */
export function weekSummary(
  days: readonly DayData[],
  settings: readonly PlatformSetting[],
  today: LocalDate,
): { netCents: Cents; text: string[] } | null {
  const week = weekRange(today);
  const inWeek = days.filter((d) => d.date >= week.start && d.date <= today);
  if (!inWeek.some(isDriven)) return null;
  const current = summarizeRange(days, week, settings, today);
  const previous = summarizeRange(
    days,
    comparableRange("week", week, today),
    settings,
    today,
  );
  const change = variation(current.netCents, previous.netCents);

  const parts: string[] = [];
  if (change != null) {
    const pct = Math.round(Math.abs(change) * 100);
    parts.push(
      pct === 0
        ? "Igual ao mesmo trecho da semana passada."
        : change > 0
          ? `${pct}% a mais que no mesmo trecho da semana passada.`
          : `${pct}% a menos que no mesmo trecho da semana passada. Semana que vem tem mais.`,
    );
  }
  const driven = inWeek.filter(isDriven);
  if (driven.length >= 2) {
    const best = driven.reduce((a, b) =>
      summarize([b], settings, [b.date]).netCents >
      summarize([a], settings, [a.date]).netCents
        ? b
        : a,
    );
    parts.push(`${formatWeekdayLong(best.date)} foi o seu melhor dia.`);
  }
  return { netCents: current.netCents, text: parts };
}

/** Rule 7: ≥ 6 consecutive days driving, ending today or yesterday. Returns the streak length. */
export function restStreak(
  days: readonly DayData[],
  today: LocalDate,
): number | null {
  const driven = new Set(days.filter(isDriven).map((d) => d.date));
  let end = driven.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (driven.has(end)) {
    n += 1;
    end = addDays(end, -1);
  }
  return n >= INSIGHTS.restStreak ? n : null;
}

export function computeInsights(input: {
  days: readonly DayData[];
  settings: readonly PlatformSetting[];
  today: LocalDate;
  maintenance: readonly MaintenanceItem[];
  reservePerDayDrivenCents: Cents | null;
  vehicleModeEnabled: boolean;
}): Insight[] {
  const { days, settings, today } = input;
  return [
    ...bestDayAndShift(days, settings, today),
    appsInsight(days, today),
    ...maintenanceInsights(input.maintenance, days),
    reserveInsight(input.reservePerDayDrivenCents, input.vehicleModeEnabled),
    consumptionInsight(days, today),
  ].filter((x): x is Insight => x !== null);
}
