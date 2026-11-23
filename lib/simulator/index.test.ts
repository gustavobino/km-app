import { describe, expect, it } from "vitest";
import { formatHoursFromDecimal } from "../units";
import type { DayData } from "../metrics/types";
import { SIMULATOR, currentMonthly, historicalBase, simulate } from "./index";

const day = (
  date: string,
  netCents: number,
  minutes: number | null,
  over: Partial<DayData> = {},
): DayData => ({
  date,
  minutes,
  km: null,
  isDayOff: false,
  shifts: null,
  earnings: [
    { source: "uber", label: null, amountCents: netCents, minutes: null },
  ],
  expenses: [],
  ...over,
});

describe("historicalBase", () => {
  it("CLAUDE.md example: 6.000 in 192 h = 31,25 per hour", () => {
    // 24 days of 8 h and R$ 250 net each = 6.000 in 192 h.
    const days = Array.from({ length: 24 }, (_, i) =>
      day(`2026-11-${String(i + 1).padStart(2, "0")}`, 25000, 480),
    );
    const b = historicalBase(days, [], "2026-11-30");
    expect(b).toEqual({
      netPerHourCents: 3125,
      daysWithHours: 24,
      thin: false,
      avgHoursPerDay: 8,
    });
  });

  it("ignores days without hours, days off and days outside the 90-day window", () => {
    const days = [
      day("2026-11-20", 30000, 600),
      day("2026-11-21", 99999, null),
      day("2026-11-22", 99999, 480, { isDayOff: true }),
      day("2026-08-01", 99999, 480), // > 90 days before
      day("2026-12-01", 99999, 480), // future
    ];
    expect(historicalBase(days, [], "2026-11-30")).toEqual({
      netPerHourCents: 3000,
      daysWithHours: 1,
      thin: true,
      avgHoursPerDay: 10,
    });
  });

  it("subtracts fees and expenses (net per hour)", () => {
    const d = day("2026-11-20", 30000, 600, {
      expenses: [
        {
          category: "fuel",
          label: null,
          amountCents: 6000,
          liters: null,
          odometerKm: null,
          fullTank: null,
        },
      ],
    });
    const pass = {
      source: "uber" as const,
      label: null,
      mode: "pass" as const,
      percent: null,
      passCents: 7000,
      passPeriod: "week" as const,
    };
    expect(historicalBase([d], [pass], "2026-11-30").netPerHourCents).toBe(
      ((30000 - 6000 - 1000) * 60) / 600,
    );
  });

  it("has no base without history", () => {
    expect(historicalBase([], [], "2026-11-30")).toEqual({
      netPerHourCents: null,
      daysWithHours: 0,
      thin: true,
      avgHoursPerDay: null,
    });
  });
});

describe("simulate", () => {
  const example = {
    targetCents: 1000000,
    hoursPerDay: 8,
    daysPerMonth: 24,
    baseNetPerHourCents: 3125,
    currentMonthlyCents: 600000,
  };

  it("matches the CLAUDE.md example", () => {
    const r = simulate(example)!;
    expect(r.perDayCents).toBe(41667); // R$ 416,67
    expect(r.perHourCents).toBe(5208); // R$ 52,08
    expect(Math.round(r.aboveRate! * 100)).toBe(67);
    expect(formatHoursFromDecimal(r.paths!.onlyMoreHours.hoursPerDay)).toBe(
      "13h20",
    );
    expect(formatHoursFromDecimal(r.paths!.betterRate.hoursPerDay)).toBe(
      "11h07",
    );
    expect(
      formatHoursFromDecimal(r.paths!.betterRateMoreDays.hoursPerDay),
    ).toBe("10h15");
    expect(r.paths!.halfway).toMatchObject({ targetCents: 800000 });
    expect(formatHoursFromDecimal(r.paths!.halfway!.hoursPerDay)).toBe("10h40");
  });

  it("flags paths above 12 h per day", () => {
    const r = simulate(example)!;
    expect(r.paths!.onlyMoreHours.highLoad).toBe(true);
    expect(r.paths!.betterRate.highLoad).toBe(false);
    expect(r.anyHighLoad).toBe(true);
    expect(simulate({ ...example, targetCents: 700000 })!.anyHighLoad).toBe(
      false,
    );
  });

  it("goes below the current pace without a halfway path", () => {
    const r = simulate({ ...example, targetCents: 500000 })!;
    expect(r.aboveRate!).toBeLessThan(0);
    expect(r.paths!.halfway).toBeNull();
    expect(
      simulate({ ...example, currentMonthlyCents: null })!.paths!.halfway,
    ).toBeNull();
  });

  it("without a base gives only per day and per hour", () => {
    expect(simulate({ ...example, baseNetPerHourCents: null })).toEqual({
      perDayCents: 41667,
      perHourCents: 5208,
      aboveRate: null,
      paths: null,
      anyHighLoad: false,
    });
    expect(
      simulate({ ...example, baseNetPerHourCents: -10 })!.paths,
    ).toBeNull();
  });

  it.each([
    { targetCents: 0 },
    { hoursPerDay: 0 },
    { daysPerMonth: 0 },
    { targetCents: Number.NaN },
  ])("returns null for %j", (bad) => {
    expect(simulate({ ...example, ...bad })).toBeNull();
  });

  it("uses the configurable constants", () => {
    expect(SIMULATOR).toMatchObject({
      rateBoost: 0.2,
      extraDays: 2,
      highLoadHours: 12,
      windowDays: 90,
      minDaysWithHours: 7,
    });
  });
});

describe("currentMonthly", () => {
  it("base × hours × days", () => {
    expect(currentMonthly(3125, 8, 24)).toBe(600000);
    expect(currentMonthly(null, 8, 24)).toBeNull();
    expect(currentMonthly(3125, 0, 24)).toBeNull();
    expect(currentMonthly(3125, 8, 0)).toBeNull();
  });
});
