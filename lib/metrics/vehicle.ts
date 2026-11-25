/**
 * "Reserva do carro" (vehicle mode, optional). Always an ESTIMATE.
 * CLAUDE.md › Modo veículo:
 *   per km   = maintenance + tires (cost_reference by category and age, or the
 *              driver's own numbers) + (insurance + IPVA per year) / km per year
 *   per day  = rent (rented) or installment (financed) spread per calendar day
 *   freeAfterReserve = net − reserve
 */
import { daysInMonth, eachDay, type DateRange, type LocalDate } from "../dates";
import { divideRound, type Cents } from "../money";
import type { DayData, PassPeriod } from "./types";
import {
  findVehicleModel,
  modelMaintenanceCentsPerKm,
  TIRES_CENTS_PER_KM,
} from "./vehicle-models";

export type Ownership = "own" | "rented" | "financed";
export type Category = "compact" | "sedan" | "suv" | "other";
export type AgeBand = "0-3" | "4-7" | "8+";

export type CostReference = {
  category: Category;
  ageBand: AgeBand;
  maintenanceCentsPerKm: number;
  tiresCentsPerKm: number;
  isPlaceholder: boolean;
};

export type Vehicle = {
  /** What the driver typed; used to recognise the model (vehicle-models.ts). */
  brand?: string | null;
  model?: string | null;
  category: Category | null;
  year: number | null;
  rentCents: Cents | null;
  rentPeriod: PassPeriod | null;
  installmentCents: Cents | null;
  insuranceYearCents: Cents | null;
  ipvaYearCents: Cents | null;
  /** Driver overrides (cents per km, may be fractional). */
  maintenanceCentsPerKm: number | null;
  tiresCentsPerKm: number | null;
};

/** Without history: 3.000 km per month (placeholder, see docs/custos.md). */
export const DEFAULT_KM_PER_MONTH = 3000;
/** Own maintenance expenses replace the reference after this many km of history. */
export const MIN_KM_FOR_OWN_MAINTENANCE = 1000;
const MAINTENANCE_LABEL =
  /manuten|revis|[óo]leo|filtro|freio|pastilha|alinhamento|balanceamento|mec[âa]nic/i;

export function ageBand(year: number | null, currentYear: number): AgeBand {
  if (year == null) return "4-7";
  const age = currentYear - year;
  if (age <= 3) return "0-3";
  if (age <= 7) return "4-7";
  return "8+";
}

export function isMaintenanceExpense(e: {
  category: string;
  label: string | null;
}): boolean {
  return e.category === "other" && MAINTENANCE_LABEL.test(e.label ?? "");
}

/**
 * Estimated km per year: average km per day driven (days with km in the
 * history window) × typical days per month × 12. Falls back to 3.000 km/month.
 */
export function estimateKmPerYear(
  history: readonly DayData[],
  typicalDaysPerMonth: number | null,
): number {
  const withKm = history.filter((d) => !d.isDayOff && (d.km ?? 0) > 0);
  if (withKm.length === 0) return DEFAULT_KM_PER_MONTH * 12;
  const avg = withKm.reduce((a, d) => a + d.km!, 0) / withKm.length;
  return Math.round(avg * (typicalDaysPerMonth ?? 22) * 12);
}

/** The driver's own maintenance cost per km from expenses tagged as maintenance, if there is enough history. */
export function ownMaintenancePerKm(
  history: readonly DayData[],
): number | null {
  const km = history.reduce((a, d) => a + (d.km ?? 0), 0);
  const spent = history
    .flatMap((d) => d.expenses)
    .filter(isMaintenanceExpense)
    .reduce((a, e) => a + e.amountCents, 0);
  if (spent === 0 || km < MIN_KM_FOR_OWN_MAINTENANCE) return null;
  return spent / km;
}

export type PerKmBreakdown = {
  maintenance: number;
  tires: number;
  insuranceAndTax: number;
  total: number;
  /** Where the maintenance number came from. */
  maintenanceSource: "driver" | "history" | "model" | "reference";
  tiresSource: "driver" | "model" | "reference";
  /** The recognised model ("Renault Kwid"), when its averages are in use. */
  modelName: string | null;
  /** A placeholder reference value was used somewhere. */
  usesPlaceholder: boolean;
};

export function perKmBreakdown(
  vehicle: Vehicle | null,
  reference: readonly CostReference[],
  opts: {
    currentYear: number;
    kmPerYear: number;
    ownMaintenancePerKm: number | null;
  },
): PerKmBreakdown {
  const known = findVehicleModel(vehicle?.brand, vehicle?.model);
  const category = vehicle?.category ?? known?.category ?? "other";
  const band = ageBand(vehicle?.year ?? null, opts.currentYear);
  const ref = reference.find(
    (r) => r.category === category && r.ageBand === band,
  );

  let maintenance: number;
  let maintenanceSource: PerKmBreakdown["maintenanceSource"];
  if (vehicle?.maintenanceCentsPerKm != null) {
    maintenance = vehicle.maintenanceCentsPerKm;
    maintenanceSource = "driver";
  } else if (opts.ownMaintenancePerKm != null) {
    maintenance = opts.ownMaintenancePerKm;
    maintenanceSource = "history";
  } else if (known) {
    maintenance = modelMaintenanceCentsPerKm(known);
    maintenanceSource = "model";
  } else {
    maintenance = ref?.maintenanceCentsPerKm ?? 0;
    maintenanceSource = "reference";
  }

  let tires: number;
  let tiresSource: PerKmBreakdown["tiresSource"];
  if (vehicle?.tiresCentsPerKm != null) {
    tires = vehicle.tiresCentsPerKm;
    tiresSource = "driver";
  } else if (known) {
    tires = TIRES_CENTS_PER_KM;
    tiresSource = "model";
  } else {
    tires = ref?.tiresCentsPerKm ?? 0;
    tiresSource = "reference";
  }

  const yearly =
    (vehicle?.insuranceYearCents ?? 0) + (vehicle?.ipvaYearCents ?? 0);
  const insuranceAndTax = opts.kmPerYear > 0 ? yearly / opts.kmPerYear : 0;

  const usesPlaceholder =
    Boolean(ref?.isPlaceholder) &&
    (maintenanceSource === "reference" || tiresSource === "reference");

  return {
    maintenance,
    tires,
    insuranceAndTax,
    total: maintenance + tires + insuranceAndTax,
    maintenanceSource,
    tiresSource,
    modelName:
      known && (maintenanceSource === "model" || tiresSource === "model")
        ? `${known.brand} ${known.model}`
        : null,
    usesPlaceholder,
  };
}

function periodDays(period: PassPeriod | null, date: LocalDate): number {
  if (period === "day") return 1;
  if (period === "week") return 7;
  return daysInMonth(date);
}

/** Rent (rented) or installment (financed) spread per calendar day over the given dates. */
export function fixedCarCostCents(
  ownership: Ownership | null,
  vehicle: Vehicle | null,
  dates: readonly LocalDate[],
): Cents {
  if (!vehicle) return 0;
  let total = 0;
  for (const d of dates) {
    if (ownership === "rented" && vehicle.rentCents)
      total += vehicle.rentCents / periodDays(vehicle.rentPeriod, d);
    if (ownership === "financed" && vehicle.installmentCents)
      total += vehicle.installmentCents / daysInMonth(d);
  }
  return Math.round(total);
}

export type Reserve = {
  perKm: PerKmBreakdown;
  km: number;
  kmPartCents: Cents;
  fixedPartCents: Cents;
  reserveCents: Cents;
  freeAfterReserveCents: Cents;
  daysDriven: number;
  /** "Separe cerca de R$ X por dia rodado" (null without days driven). */
  perDayDrivenCents: Cents | null;
};

/**
 * Reserve for a period. `elapsed` are the calendar days already lived in the
 * period (rent/installment are charged for these).
 */
export function vehicleReserve(input: {
  days: readonly DayData[];
  netCents: Cents;
  elapsed: DateRange;
  ownership: Ownership | null;
  vehicle: Vehicle | null;
  perKm: PerKmBreakdown;
}): Reserve {
  const km = input.days.reduce((a, d) => a + (d.km ?? 0), 0);
  const kmPart = Math.round(input.perKm.total * km);
  const fixedPart = fixedCarCostCents(
    input.ownership,
    input.vehicle,
    eachDay(input.elapsed),
  );
  const reserve = kmPart + fixedPart;
  const daysDriven = input.days.filter(
    (d) => !d.isDayOff && d.earnings.some((e) => e.amountCents > 0),
  ).length;
  return {
    perKm: input.perKm,
    km,
    kmPartCents: kmPart,
    fixedPartCents: fixedPart,
    reserveCents: reserve,
    freeAfterReserveCents: input.netCents - reserve,
    daysDriven,
    perDayDrivenCents: daysDriven > 0 ? divideRound(reserve, daysDriven) : null,
  };
}
