import { describe, expect, it } from "vitest";
import {
  bars,
  comparableRange,
  compareApps,
  elapsedRange,
  monthGoal,
  periodRange,
  summarizeRange,
  variation,
} from "./period";
import type { DayData, Earning, PlatformSetting } from "./types";

const earn = (
  source: Earning["source"],
  amountCents: number,
  minutes: number | null = null,
  label: string | null = null,
): Earning => ({
  source,
  label,
  amountCents,
  minutes,
});
const day = (date: string, over: Partial<DayData> = {}): DayData => ({
  date,
  minutes: null,
  km: null,
  isDayOff: false,
  shifts: null,
  earnings: [],
  expenses: [],
  ...over,
});
const spend = (amountCents: number) => ({
  category: "fuel" as const,
  label: null,
  amountCents,
  liters: null,
  odometerKm: null,
  fullTank: null,
});

describe("ranges", () => {
  it("builds day, week (Mon–Sun) and month ranges", () => {
    expect(periodRange("day", "2026-11-25")).toEqual({
      start: "2026-11-25",
      end: "2026-11-25",
    });
    expect(periodRange("week", "2026-11-25")).toEqual({
      start: "2026-11-23",
      end: "2026-11-29",
    });
    expect(periodRange("month", "2026-11-25")).toEqual({
      start: "2026-11-01",
      end: "2026-11-30",
    });
  });

  it("knows the elapsed part", () => {
    expect(
      elapsedRange({ start: "2026-11-23", end: "2026-11-29" }, "2026-11-25"),
    ).toEqual({
      start: "2026-11-23",
      end: "2026-11-25",
    });
    expect(
      elapsedRange({ start: "2026-11-16", end: "2026-11-22" }, "2026-11-25")
        .end,
    ).toBe("2026-11-22");
    expect(
      elapsedRange({ start: "2026-12-01", end: "2026-12-31" }, "2026-11-25"),
    ).toEqual({
      start: "2026-12-01",
      end: "2026-12-01",
    });
  });

  it.each([
    ["day", "2026-11-25", { start: "2026-11-24", end: "2026-11-24" }],
    ["week", "2026-11-25", { start: "2026-11-16", end: "2026-11-18" }],
    ["month", "2026-11-25", { start: "2026-10-01", end: "2026-10-25" }],
    ["month", "2026-03-31", { start: "2026-02-01", end: "2026-02-28" }],
  ] as const)(
    "compares %s on %s with the same stretch before",
    (period, today, expected) => {
      expect(
        comparableRange(period, periodRange(period, today), today),
      ).toEqual(expected);
    },
  );
});

describe("summarizeRange", () => {
  it("matches the CLAUDE.md example month (8.940 − 2.540 = 6.400, 71,6%)", () => {
    const days = [
      day("2026-11-03", {
        earnings: [earn("uber", 500000)],
        expenses: [spend(140000)],
      }),
      day("2026-11-10", {
        earnings: [earn("99", 394000)],
        expenses: [spend(114000)],
      }),
      day("2026-10-31", { earnings: [earn("uber", 99999)] }), // outside
    ];
    const s = summarizeRange(
      days,
      periodRange("month", "2026-11-23"),
      [],
      "2026-11-23",
    );
    expect(s).toMatchObject({
      grossCents: 894000,
      expensesCents: 254000,
      netCents: 640000,
    });
    expect(Math.round((s.netCents / s.grossCents) * 1000) / 10).toBe(71.6);
  });

  it("charges passes only for days that already happened", () => {
    const pass: PlatformSetting = {
      source: "uber",
      label: null,
      mode: "pass",
      percent: null,
      passCents: 7000,
      passPeriod: "week",
    };
    const week = periodRange("week", "2026-11-25"); // Mon 23 → Wed 25 elapsed
    expect(
      summarizeRange([], week, [pass], "2026-11-25").platformFeeCents,
    ).toBe(3000);
    expect(
      summarizeRange(
        [],
        { start: "2026-12-01", end: "2026-12-07" },
        [pass],
        "2026-11-25",
      ).platformFeeCents,
    ).toBe(0);
  });
});

describe("variation", () => {
  it.each([
    [108, 100, 0.08],
    [95, 100, -0.05],
    [100, 0, null],
    [100, -10, null],
  ])("%i vs %i", (a, b, expected) => {
    const v = variation(a, b);
    if (expected === null) expect(v).toBeNull();
    else expect(v).toBeCloseTo(expected, 10);
  });
});

describe("bars", () => {
  const settings: PlatformSetting[] = [];
  it("one bar per weekday, best day highlighted, future days empty", () => {
    const days = [
      day("2026-11-23", { earnings: [earn("uber", 10000)] }),
      day("2026-11-25", { earnings: [earn("uber", 30000)] }),
      day("2026-11-28", { earnings: [earn("uber", 99999)] }), // future: ignored
    ];
    const b = bars(
      "week",
      periodRange("week", "2026-11-25"),
      days,
      settings,
      "2026-11-25",
    );
    expect(b.map((x) => x.label)).toEqual([
      "Seg",
      "Ter",
      "Qua",
      "Qui",
      "Sex",
      "Sáb",
      "Dom",
    ]);
    expect(b.map((x) => x.netCents)).toEqual([10000, 0, 30000, 0, 0, 0, 0]);
    expect(b.filter((x) => x.best).map((x) => x.longLabel)).toEqual(["quarta"]);
  });

  it("one bar per week in a month", () => {
    const days = [
      day("2026-11-01", { earnings: [earn("uber", 5000)] }),
      day("2026-11-10", { earnings: [earn("uber", 8000)] }),
    ];
    const b = bars(
      "month",
      periodRange("month", "2026-11-23"),
      days,
      settings,
      "2026-11-23",
    );
    // November 2026: Sun 1 | 2–8 | 9–15 | 16–22 | 23–29 | 30
    expect(b.map((x) => [x.label, x.netCents])).toEqual([
      ["S1", 5000],
      ["S2", 0],
      ["S3", 8000],
      ["S4", 0],
      ["S5", 0],
      ["S6", 0],
    ]);
    expect(b.find((x) => x.best)?.longLabel).toBe("3ª semana");
  });

  it("no best bar when nothing was earned, no bars for a single day", () => {
    const b = bars(
      "week",
      periodRange("week", "2026-11-25"),
      [],
      settings,
      "2026-11-25",
    );
    expect(b.some((x) => x.best)).toBe(false);
    expect(
      bars("day", periodRange("day", "2026-11-25"), [], settings, "2026-11-25"),
    ).toEqual([]);
  });
});

describe("compareApps", () => {
  it("compares per hour only with hours per app", () => {
    const c = compareApps([
      day("2026-11-23", {
        earnings: [earn("uber", 21545, 300), earn("99", 11250, 180)],
      }),
      day("2026-11-24", { earnings: [earn("uber", 10000)] }), // no per-app hours: ignored for the rate
    ]);
    expect(c).toEqual({
      mode: "perHour",
      rows: [
        { key: "uber", source: "uber", label: null, cents: 4309, share: 0 },
        { key: "99", source: "99", label: null, cents: 3750, share: 0 },
      ],
    });
  });

  it("falls back to each app's share of the earnings", () => {
    const c = compareApps([
      day("2026-11-23", {
        earnings: [
          earn("uber", 15000, 300),
          earn("99", 5000),
          earn("other", 0, null, "x"),
        ],
      }),
      day("2026-11-24", {
        earnings: [
          earn("other", 5000, null, " inDrive "),
          earn("other", 5000, null, "INDRIVE"),
        ],
      }),
    ]);
    expect(c?.mode).toBe("share");
    expect(c?.rows.map((r) => [r.key, r.cents, r.share])).toEqual([
      ["uber", 15000, 0.5],
      ["other:indrive", 10000, 1 / 3],
      ["99", 5000, 5000 / 30000],
    ]);
  });

  it("needs at least two apps", () => {
    expect(
      compareApps([day("2026-11-23", { earnings: [earn("uber", 100)] })]),
    ).toBeNull();
    expect(compareApps([])).toBeNull();
  });

  it("handles apps with hours but no money", () => {
    const c = compareApps([
      day("2026-11-23", { earnings: [earn("uber", 0, 60), earn("99", 0, 60)] }),
    ]);
    expect(c).toMatchObject({
      mode: "perHour",
      rows: [{ cents: 0 }, { cents: 0 }],
    });
    const share = compareApps([
      day("2026-11-23", { earnings: [earn("uber", 0, 60), earn("99", 0)] }),
    ]);
    expect(share).toBeNull();
  });

  it("groups unnamed other apps together", () => {
    const c = compareApps([
      day("2026-11-23", {
        earnings: [earn("uber", 100), earn("other", 300, null, null)],
      }),
    ]);
    expect(c?.rows.map((r) => r.key)).toEqual(["other:", "uber"]);
  });
});

describe("monthGoal", () => {
  it("matches the reference: 6.400 of 8.000 with 7 days left", () => {
    expect(monthGoal(640000, 800000, "2026-11-24")).toEqual({
      goalCents: 800000,
      netCents: 640000,
      ratio: 0.8,
      reached: false,
      remainingCents: 160000,
      daysLeft: 7,
      perDayCents: 22857,
    });
  });
  it("handles a reached goal and no goal", () => {
    expect(monthGoal(900000, 800000, "2026-11-30")).toMatchObject({
      reached: true,
      remainingCents: 0,
      perDayCents: 0,
      daysLeft: 1,
    });
    expect(monthGoal(-5000, 800000, "2026-11-30")?.ratio).toBe(0);
    expect(monthGoal(1000, null, "2026-11-30")).toBeNull();
    expect(monthGoal(1000, 0, "2026-11-30")).toBeNull();
  });
});
