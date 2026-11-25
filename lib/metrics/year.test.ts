import { describe, expect, it } from "vitest";
import type { DayData, Earning } from "./types";
import { yearRange, yearSummary } from "./year";

const earning = (
  source: Earning["source"],
  amountCents: number,
  label: string | null = null,
): Earning => ({ source, label, amountCents, minutes: null });

const day = (
  date: string,
  earnings: Earning[],
  over: Partial<DayData> = {},
): DayData => ({
  date,
  minutes: 480,
  km: 150,
  isDayOff: false,
  shifts: null,
  earnings,
  expenses: [],
  ...over,
});

const DAYS: DayData[] = [
  day("2025-12-31", [earning("uber", 99_999)]), // other year
  day("2026-01-10", [earning("uber", 20_000), earning("99", 10_000)], {
    expenses: [
      {
        category: "fuel",
        label: null,
        amountCents: 5_000,
        liters: null,
        odometerKm: null,
        fullTank: null,
      },
    ],
  }),
  day("2026-03-05", [earning("uber", 30_000)]),
  day("2026-03-06", [earning("other", 10_000, " inDrive ")]),
  day("2026-03-07", [earning("other", 5_000, "indrive")]),
  day("2026-04-01", [], { isDayOff: true, minutes: null, km: null }),
];

describe("yearSummary", () => {
  const y = yearSummary(DAYS, 2026, [], "2026-11-25");

  it("totals the year only", () => {
    expect(y.range).toEqual(yearRange(2026));
    expect(y.summary).toMatchObject({
      grossCents: 75_000,
      expensesCents: 5_000,
      netCents: 70_000,
      daysWorked: 4,
      km: 600,
      minutes: 1920,
    });
    expect(y.netPerDayCents).toBe(17_500);
  });

  it("lists 12 months, marks the future and finds the best month", () => {
    expect(y.months).toHaveLength(12);
    expect(y.months[0]).toMatchObject({
      start: "2026-01-01",
      netCents: 25_000,
      grossCents: 30_000,
      daysWorked: 1,
      future: false,
    });
    expect(y.months[11]!.future).toBe(true);
    expect(y.months[10]!.future).toBe(false);
    expect(y.best?.start).toBe("2026-03-01");
    expect(y.best?.netCents).toBe(45_000);
  });

  it("gives each app's share, merging the same other app by name", () => {
    expect(y.apps.map((a) => [a.source, a.label, a.cents])).toEqual([
      ["uber", null, 50_000],
      ["other", "inDrive", 15_000],
      ["99", null, 10_000],
    ]);
    expect(y.apps[0]!.share).toBeCloseTo(50_000 / 75_000);
  });

  it("is empty without days", () => {
    const e = yearSummary([], 2026, [], "2026-11-25");
    expect(e.best).toBeNull();
    expect(e.netPerDayCents).toBeNull();
    expect(e.apps).toEqual([]);
    expect(e.summary.netCents).toBe(0);
  });
});
