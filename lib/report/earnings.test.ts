import { describe, expect, it } from "vitest";
import type { DayData, Earning } from "../metrics/types";
import { buildEarningsReport, periodLabel, reportMonths } from "./earnings";

const e = (
  source: Earning["source"],
  amountCents: number,
  label: string | null = null,
): Earning => ({ source, label, amountCents, minutes: null });

const day = (date: string, earnings: Earning[], fuel = 0): DayData => ({
  date,
  minutes: null,
  km: null,
  isDayOff: false,
  shifts: null,
  earnings,
  expenses: fuel
    ? [
        {
          category: "fuel",
          label: null,
          amountCents: fuel,
          liters: null,
          odometerKm: null,
          fullTank: null,
        },
      ]
    : [],
});

describe("reportMonths", () => {
  it("takes N complete months before the current one", () => {
    expect(reportMonths("3m", "2026-11-25")).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
    expect(reportMonths("6m", "2026-02-10")).toEqual([
      "2025-08-01",
      "2025-09-01",
      "2025-10-01",
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
    ]);
    expect(reportMonths("12m", "2026-11-25")).toHaveLength(12);
    expect(reportMonths("12m", "2026-11-25")[0]).toBe("2025-11-01");
  });

  it("this year: January up to the current month", () => {
    expect(reportMonths("year", "2026-03-02")).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });
});

describe("periodLabel", () => {
  it.each([
    [["2026-08-01", "2026-10-01"], "Agosto a outubro de 2026"],
    [["2025-12-01", "2026-02-01"], "Dezembro de 2025 a fevereiro de 2026"],
    [["2026-01-01"], "Janeiro de 2026"],
  ])("%j → %s", (months, label) => {
    expect(periodLabel(months)).toBe(label);
  });
});

describe("buildEarningsReport", () => {
  const days = [
    day("2026-07-31", [e("uber", 99_999)]), // before the period
    day("2026-08-10", [e("uber", 20_000), e("99", 10_000)], 5_000),
    day("2026-10-03", [e("uber", 40_000), e("other", 15_000, "inDrive")]),
    day("2026-10-04", [e("other", 15_000, "indrive")]),
    day("2026-11-02", [e("uber", 77_777)]), // current month: outside "3m"
  ];

  it("totals each month (empty ones too) and the period", () => {
    const r = buildEarningsReport(days, "3m", [], "2026-11-25");
    expect(r.periodLabel).toBe("Agosto a outubro de 2026");
    expect(r.months.map((m) => [m.label, m.grossCents, m.netCents])).toEqual([
      ["Agosto de 2026", 30_000, 25_000],
      ["Setembro de 2026", 0, 0],
      ["Outubro de 2026", 70_000, 70_000],
    ]);
    expect(r.months[0]).toMatchObject({
      costsCents: 5_000,
      daysWorked: 1,
      until: null,
    });
    expect(r.total).toEqual({
      daysWorked: 3,
      grossCents: 100_000,
      costsCents: 5_000,
      netCents: 95_000,
    });
    expect(r.averageGrossCents).toBe(33_333);
    expect(r.averageNetCents).toBe(31_667);
    expect(r.hasData).toBe(true);
  });

  it("groups apps by name with their share", () => {
    const r = buildEarningsReport(days, "3m", [], "2026-11-25");
    expect(r.apps).toEqual([
      { name: "Uber", cents: 60_000, share: 0.6 },
      { name: "inDrive", cents: 30_000, share: 0.3 },
      { name: "99", cents: 10_000, share: 0.1 },
    ]);
  });

  it("this year marks the running month as partial", () => {
    const r = buildEarningsReport(days, "year", [], "2026-11-25");
    expect(r.months).toHaveLength(11);
    expect(r.months[10]).toMatchObject({
      until: "2026-11-25",
      grossCents: 77_777,
    });
    expect(r.months[9]!.until).toBeNull();
  });

  it("works without data", () => {
    const r = buildEarningsReport([], "6m", [], "2026-11-25");
    expect(r.hasData).toBe(false);
    expect(r.apps).toEqual([]);
    expect(r.averageGrossCents).toBe(0);
  });
});
