import { describe, expect, it } from "vitest";
import {
  expensesCents,
  grossCents,
  passFeeCents,
  percentFeeCents,
  perHourCents,
  perKmCents,
  summarize,
} from "./core";
import type { DayData, Earning, Expense, PlatformSetting } from "./types";

const earn = (
  source: Earning["source"],
  amountCents: number,
  label: string | null = null,
  minutes: number | null = null,
): Earning => ({
  source,
  label,
  amountCents,
  minutes,
});
const spend = (
  category: Expense["category"],
  amountCents: number,
): Expense => ({
  category,
  label: null,
  amountCents,
  liters: null,
  odometerKm: null,
  fullTank: null,
});
const day = (over: Partial<DayData>): DayData => ({
  date: "2026-11-23",
  minutes: null,
  km: null,
  isDayOff: false,
  shifts: null,
  earnings: [],
  expenses: [],
  ...over,
});
const setting = (over: Partial<PlatformSetting>): PlatformSetting => ({
  source: "uber",
  label: null,
  mode: "net_already",
  percent: null,
  passCents: null,
  passPeriod: null,
  ...over,
});

// CLAUDE.md example day: 212,50 + 98,00 + 40,00; expenses 85,00 + 22,00; 8,5 h; 142 km.
const EXAMPLE_DAY = day({
  minutes: 510,
  km: 142,
  earnings: [
    earn("uber", 21250),
    earn("99", 9800),
    earn("other", 4000, "inDrive"),
  ],
  expenses: [spend("fuel", 8500), spend("food", 2200)],
});

describe("totals", () => {
  it("sums gross and expenses", () => {
    expect(grossCents(EXAMPLE_DAY.earnings)).toBe(35050);
    expect(expensesCents(EXAMPLE_DAY.expenses)).toBe(10700);
    expect(grossCents([])).toBe(0);
  });
});

describe("rates", () => {
  it.each([
    [35050, 510, 4124],
    [214000, 52 * 60, 4115],
    [100, 0, null],
    [100, null, null],
    [100, -5, null],
  ])("perHour(%i, %s min) = %s", (cents, minutes, expected) => {
    expect(perHourCents(cents, minutes)).toBe(expected);
  });
  it.each([
    [35050, 142, 247],
    [214000, 880, 243],
    [100, 0, null],
    [100, undefined, null],
  ])("perKm(%i, %s km) = %s", (cents, km, expected) => {
    expect(perKmCents(cents, km)).toBe(expected);
  });
});

describe("platform fees", () => {
  it("is zero when the driver logs what they received (net_already)", () => {
    expect(percentFeeCents(EXAMPLE_DAY.earnings, [setting({})])).toBe(0);
    expect(passFeeCents([setting({})], ["2026-11-23"])).toBe(0);
  });
  it("applies percentages per app, matching other apps by name", () => {
    const settings = [
      setting({ source: "uber", mode: "percent", percent: 10 }),
      setting({
        source: "other",
        label: "INDRIVE ",
        mode: "percent",
        percent: 12.5,
      }),
      setting({
        source: "other",
        label: "Outro",
        mode: "percent",
        percent: 50,
      }),
      setting({ source: "99", mode: "percent", percent: null }),
    ];
    // 10% of 212,50 = 21,25; 12,5% of 40,00 = 5,00; 99 has no percent.
    expect(percentFeeCents(EXAMPLE_DAY.earnings, settings)).toBe(2125 + 500);
  });
  it("matches an unnamed other app to an unnamed setting", () => {
    expect(
      percentFeeCents(
        [earn("other", 10000, null)],
        [
          setting({
            source: "other",
            label: null,
            mode: "percent",
            percent: 20,
          }),
        ],
      ),
    ).toBe(2000);
  });
  it("spreads passes per calendar day", () => {
    const week = setting({ mode: "pass", passCents: 7000, passPeriod: "week" });
    const daily = setting({
      source: "99",
      mode: "pass",
      passCents: 1500,
      passPeriod: "day",
    });
    const month = setting({
      source: "other",
      mode: "pass",
      passCents: 30000,
      passPeriod: "month",
    });
    const noAmount = setting({
      mode: "pass",
      passCents: null,
      passPeriod: "week",
    });
    expect(passFeeCents([week], ["2026-11-23"])).toBe(1000);
    expect(passFeeCents([week], ["2026-11-23", "2026-11-24"])).toBe(2000);
    expect(passFeeCents([daily], ["2026-11-23"])).toBe(1500);
    expect(passFeeCents([month], ["2026-11-23"])).toBe(1000); // November: 30 days
    expect(passFeeCents([month], ["2026-02-10"])).toBe(1071); // 300,00 / 28
    expect(
      passFeeCents(
        [noAmount, setting({ mode: "pass", passCents: 700 })],
        ["2026-11-23"],
      ),
    ).toBe(700);
  });
});

describe("summarize", () => {
  it("matches the CLAUDE.md example day", () => {
    expect(summarize([EXAMPLE_DAY])).toEqual({
      grossCents: 35050,
      platformFeeCents: 0,
      expensesCents: 10700,
      netCents: 24350,
      minutes: 510,
      km: 142,
      grossPerHourCents: 4124,
      grossPerKmCents: 247,
      netPerHourCents: 2865,
      daysWorked: 1,
    });
  });

  it("matches the CLAUDE.md example week", () => {
    const week = Array.from({ length: 4 }, (_, i) =>
      day({
        date: `2026-11-2${3 + i}`,
        minutes: 13 * 60,
        km: 220,
        earnings: [earn("uber", 53500)],
        expenses: [spend("fuel", 15300)],
      }),
    );
    const s = summarize(week);
    expect(s).toMatchObject({
      grossCents: 214000,
      expensesCents: 61200,
      netCents: 152800,
      minutes: 52 * 60,
      km: 880,
      grossPerHourCents: 4115,
      grossPerKmCents: 243,
      daysWorked: 4,
    });
  });

  it("omits rates without hours or km", () => {
    const s = summarize([day({ earnings: [earn("uber", 10000)] })]);
    expect(s.minutes).toBeNull();
    expect(s.km).toBeNull();
    expect(s.grossPerHourCents).toBeNull();
    expect(s.grossPerKmCents).toBeNull();
    expect(s.netPerHourCents).toBeNull();
  });

  it("uses only days with hours (or km) for the rates", () => {
    const withAll = day({
      date: "2026-11-23",
      minutes: 600,
      km: 100,
      earnings: [earn("uber", 30000)],
    });
    const noHours = day({
      date: "2026-11-24",
      km: 0,
      earnings: [earn("uber", 50000)],
      expenses: [spend("food", 1000)],
    });
    const settings = [
      setting({ mode: "pass", passCents: 700, passPeriod: "week" }),
    ];
    const s = summarize([withAll, noHours], settings, [
      "2026-11-23",
      "2026-11-24",
    ]);
    expect(s.grossCents).toBe(80000);
    expect(s.platformFeeCents).toBe(200);
    expect(s.netCents).toBe(80000 - 200 - 1000);
    expect(s.grossPerHourCents).toBe(3000); // 300,00 / 10 h, ignoring the day without hours
    expect(s.netPerHourCents).toBe(2990); // (300,00 − 1,00 of pass) / 10 h
    expect(s.grossPerKmCents).toBe(300);
  });

  it("does not count days off or empty days as worked", () => {
    const s = summarize([
      day({ isDayOff: true }),
      day({ earnings: [earn("uber", 0)] }),
    ]);
    expect(s.daysWorked).toBe(0);
    expect(s.netCents).toBe(0);
  });

  it("subtracts platform fees from net", () => {
    const s = summarize(
      [EXAMPLE_DAY],
      [setting({ source: "uber", mode: "percent", percent: 10 })],
      [],
    );
    expect(s.platformFeeCents).toBe(2125);
    expect(s.netCents).toBe(24350 - 2125);
  });
});
