/** The month's car reserve, shared by Lucro líquido and Insights. */
import { addDays, monthRange, type LocalDate } from "../dates";
import { elapsedRange, summarizeRange } from "./period";
import type { DayData, PlatformSetting } from "./types";
import {
  estimateKmPerYear,
  ownMaintenancePerKm,
  perKmBreakdown,
  vehicleReserve,
  type CostReference,
  type Ownership,
  type Reserve,
  type Vehicle,
} from "./vehicle";

export const RESERVE_HISTORY_DAYS = 90;

export type ReserveContext = {
  ownership: Ownership | null;
  vehicle: Vehicle | null;
  reference: readonly CostReference[];
  typicalDaysPerMonth: number | null;
};

export function monthReserve(
  days: readonly DayData[],
  today: LocalDate,
  ctx: ReserveContext,
  settings: readonly PlatformSetting[],
): { netCents: number; reserve: Reserve } {
  const month = monthRange(today);
  const monthDays = days.filter(
    (d) => d.date >= month.start && d.date <= month.end,
  );
  const historyStart = addDays(today, -RESERVE_HISTORY_DAYS);
  const history = days.filter((d) => d.date >= historyStart && d.date <= today);
  const netCents = summarizeRange(days, month, settings, today).netCents;
  const perKm = perKmBreakdown(ctx.vehicle, ctx.reference, {
    currentYear: Number(today.slice(0, 4)),
    kmPerYear: estimateKmPerYear(history, ctx.typicalDaysPerMonth),
    ownMaintenancePerKm: ownMaintenancePerKm(history),
  });
  const reserve = vehicleReserve({
    days: monthDays,
    netCents,
    elapsed: elapsedRange(month, today),
    ownership: ctx.ownership,
    vehicle: ctx.vehicle,
    perKm,
  });
  return { netCents, reserve };
}
