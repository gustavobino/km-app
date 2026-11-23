import { describe, expect, it } from "vitest";
import type { DayData, Expense } from "./types";
import {
  DEFAULT_KM_PER_MONTH,
  ageBand,
  estimateKmPerYear,
  fixedCarCostCents,
  isMaintenanceExpense,
  ownMaintenancePerKm,
  perKmBreakdown,
  vehicleReserve,
  type CostReference,
  type Vehicle,
} from "./vehicle";

const REF: CostReference[] = [
  {
    category: "compact",
    ageBand: "0-3",
    maintenanceCentsPerKm: 8,
    tiresCentsPerKm: 3,
    isPlaceholder: true,
  },
  {
    category: "compact",
    ageBand: "4-7",
    maintenanceCentsPerKm: 10,
    tiresCentsPerKm: 3,
    isPlaceholder: true,
  },
  {
    category: "other",
    ageBand: "4-7",
    maintenanceCentsPerKm: 11.5,
    tiresCentsPerKm: 3.5,
    isPlaceholder: false,
  },
];

const car = (over: Partial<Vehicle> = {}): Vehicle => ({
  category: "compact",
  year: 2024,
  rentCents: null,
  rentPeriod: null,
  installmentCents: null,
  insuranceYearCents: null,
  ipvaYearCents: null,
  maintenanceCentsPerKm: null,
  tiresCentsPerKm: null,
  ...over,
});

const expense = (
  category: Expense["category"],
  amountCents: number,
  label: string | null = null,
): Expense => ({
  category,
  label,
  amountCents,
  liters: null,
  odometerKm: null,
  fullTank: null,
});

const day = (
  date: string,
  km: number | null,
  over: Partial<DayData> = {},
): DayData => ({
  date,
  minutes: null,
  km,
  isDayOff: false,
  shifts: null,
  earnings: [
    { source: "uber", label: null, amountCents: 10000, minutes: null },
  ],
  expenses: [],
  ...over,
});

describe("ageBand", () => {
  it.each([
    [2024, "0-3"],
    [2023, "0-3"],
    [2022, "4-7"],
    [2019, "4-7"],
    [2018, "8+"],
    [null, "4-7"],
  ] as const)("%s in 2026 → %s", (year, band) => {
    expect(ageBand(year, 2026)).toBe(band);
  });
});

describe("maintenance detection", () => {
  it.each([
    ["Troca de óleo", true],
    ["revisão 40 mil", true],
    ["Pastilha de freio", true],
    ["Manutenção", true],
    ["lavagem", false],
    [null, false],
  ])("%s → %s", (label, expected) => {
    expect(isMaintenanceExpense({ category: "other", label })).toBe(expected);
  });
  it("only counts the 'other' category", () => {
    expect(isMaintenanceExpense({ category: "fuel", label: "óleo" })).toBe(
      false,
    );
  });
});

describe("estimateKmPerYear", () => {
  it("uses the average km per driven day × typical days × 12", () => {
    const history = [
      day("2026-11-20", 150),
      day("2026-11-21", 130),
      day("2026-11-22", null),
      day("2026-11-23", 200, { isDayOff: true }),
    ];
    expect(estimateKmPerYear(history, 24)).toBe(140 * 24 * 12);
    expect(estimateKmPerYear(history, null)).toBe(140 * 22 * 12);
  });
  it("falls back to 3.000 km per month", () => {
    expect(estimateKmPerYear([], 24)).toBe(DEFAULT_KM_PER_MONTH * 12);
  });
});

describe("ownMaintenancePerKm", () => {
  it("needs maintenance expenses and at least 1.000 km", () => {
    const withOil = [
      day("2026-11-01", 600, {
        expenses: [expense("other", 30000, "troca de óleo")],
      }),
      day("2026-11-02", 600),
      day("2026-11-03", null),
    ];
    expect(ownMaintenancePerKm(withOil)).toBe(25);
    expect(ownMaintenancePerKm(withOil.slice(0, 1))).toBeNull();
    expect(
      ownMaintenancePerKm([
        day("2026-11-01", 5000, {
          expenses: [expense("other", 1000, "lanche")],
        }),
      ]),
    ).toBeNull();
  });
});

describe("perKmBreakdown", () => {
  const opts = {
    currentYear: 2026,
    kmPerYear: 36000,
    ownMaintenancePerKm: null,
  };

  it("uses the reference by category and age (placeholder flagged)", () => {
    expect(perKmBreakdown(car(), REF, opts)).toEqual({
      maintenance: 8,
      tires: 3,
      insuranceAndTax: 0,
      total: 11,
      maintenanceSource: "reference",
      tiresSource: "reference",
      usesPlaceholder: true,
    });
  });

  it("adds insurance + IPVA spread over the km per year", () => {
    const b = perKmBreakdown(
      car({ insuranceYearCents: 240000, ipvaYearCents: 120000 }),
      REF,
      opts,
    );
    expect(b.insuranceAndTax).toBe(10);
    expect(b.total).toBe(21);
  });

  it("prefers the driver's numbers, then their maintenance history", () => {
    const driver = perKmBreakdown(
      car({ maintenanceCentsPerKm: 22, tiresCentsPerKm: 5 }),
      REF,
      { ...opts, ownMaintenancePerKm: 99 },
    );
    expect(driver).toMatchObject({
      maintenance: 22,
      tires: 5,
      maintenanceSource: "driver",
      tiresSource: "driver",
      usesPlaceholder: false,
    });
    const history = perKmBreakdown(car(), REF, {
      ...opts,
      ownMaintenancePerKm: 25,
    });
    expect(history).toMatchObject({
      maintenance: 25,
      tires: 3,
      maintenanceSource: "history",
      usesPlaceholder: true,
    });
  });

  it("defaults to 'other' and 4–7 years without car data; zero without a reference row", () => {
    expect(perKmBreakdown(null, REF, opts)).toMatchObject({
      maintenance: 11.5,
      tires: 3.5,
      usesPlaceholder: false,
    });
    expect(perKmBreakdown(car({ category: "suv" }), REF, opts)).toMatchObject({
      total: 0,
      usesPlaceholder: false,
    });
    expect(
      perKmBreakdown(car({ insuranceYearCents: 100 }), REF, {
        ...opts,
        kmPerYear: 0,
      }).insuranceAndTax,
    ).toBe(0);
  });
});

describe("fixedCarCostCents", () => {
  const nov = ["2026-11-01", "2026-11-02"];
  it("spreads rent by its period and installments by month", () => {
    expect(
      fixedCarCostCents(
        "rented",
        car({ rentCents: 70000, rentPeriod: "week" }),
        nov,
      ),
    ).toBe(20000);
    expect(
      fixedCarCostCents(
        "rented",
        car({ rentCents: 10000, rentPeriod: "day" }),
        nov,
      ),
    ).toBe(20000);
    expect(
      fixedCarCostCents(
        "rented",
        car({ rentCents: 300000, rentPeriod: "month" }),
        nov,
      ),
    ).toBe(20000);
    expect(
      fixedCarCostCents("financed", car({ installmentCents: 150000 }), nov),
    ).toBe(10000);
  });
  it("is zero for own cars or missing values", () => {
    expect(
      fixedCarCostCents(
        "own",
        car({ rentCents: 70000, rentPeriod: "week" }),
        nov,
      ),
    ).toBe(0);
    expect(fixedCarCostCents("rented", car(), nov)).toBe(0);
    expect(fixedCarCostCents("financed", null, nov)).toBe(0);
    expect(fixedCarCostCents(null, car({ installmentCents: 1 }), nov)).toBe(0);
  });
});

describe("vehicleReserve", () => {
  it("matches the CLAUDE.md month: reserve 1.320,00 → free 5.080,00", () => {
    // 3.000 km × R$ 0,44/km = R$ 1.320,00 (22 maintenance + 12 tires + 10 insurance/IPVA).
    const perKm = perKmBreakdown(
      car({
        maintenanceCentsPerKm: 22,
        tiresCentsPerKm: 12,
        insuranceYearCents: 240000,
        ipvaYearCents: 120000,
      }),
      REF,
      { currentYear: 2026, kmPerYear: 36000, ownMaintenancePerKm: null },
    );
    const days = Array.from({ length: 20 }, (_, i) =>
      day(`2026-11-${String(i + 1).padStart(2, "0")}`, 150),
    );
    const r = vehicleReserve({
      days,
      netCents: 640000,
      elapsed: { start: "2026-11-01", end: "2026-11-30" },
      ownership: "own",
      vehicle: null,
      perKm,
    });
    expect(r).toMatchObject({
      km: 3000,
      kmPartCents: 132000,
      fixedPartCents: 0,
      reserveCents: 132000,
      freeAfterReserveCents: 508000,
      daysDriven: 20,
      perDayDrivenCents: 6600,
    });
  });

  it("adds rent for the elapsed days and handles no driven days", () => {
    const perKm = perKmBreakdown(null, [], {
      currentYear: 2026,
      kmPerYear: 36000,
      ownMaintenancePerKm: null,
    });
    const r = vehicleReserve({
      days: [day("2026-11-01", null, { isDayOff: true, earnings: [] })],
      netCents: 0,
      elapsed: { start: "2026-11-01", end: "2026-11-07" },
      ownership: "rented",
      vehicle: car({ rentCents: 70000, rentPeriod: "week" }),
      perKm,
    });
    expect(r).toMatchObject({
      reserveCents: 70000,
      freeAfterReserveCents: -70000,
      daysDriven: 0,
      perDayDrivenCents: null,
    });
  });
});
