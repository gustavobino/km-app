import { describe, expect, it } from "vitest";
import { addDays } from "../dates";
import type { DayData, Earning, Expense, Shift } from "../metrics/types";
import {
  INSIGHTS,
  appsInsight,
  bestDayAndShift,
  computeInsights,
  consumptionInsight,
  fills,
  kmSince,
  latestOdometer,
  maintenanceInsights,
  reserveInsight,
  restStreak,
  tankToTank,
  weekSummary,
  type MaintenanceItem,
} from "./index";

const TODAY = "2026-11-29"; // Sunday
const earn = (
  source: Earning["source"],
  amountCents: number,
  minutes: number | null = null,
): Earning => ({
  source,
  label: null,
  amountCents,
  minutes,
});
const day = (
  date: string,
  net: number,
  minutes: number | null = 600,
  over: Partial<DayData> = {},
): DayData => ({
  date,
  minutes,
  km: null,
  isDayOff: false,
  shifts: null,
  earnings: [earn("uber", net)],
  expenses: [],
  ...over,
});
const fuel = (
  liters: number,
  odometerKm: number,
  fullTank = true,
): Expense => ({
  category: "fuel",
  label: null,
  amountCents: 10000,
  liters,
  odometerKm,
  fullTank,
});

/** 4 weeks: Saturdays earn `satPerHour` per hour, other days 30,00/h. */
function weeks(
  satNet: number,
  opts: { shifts?: (d: string) => Shift[] | null } = {},
) {
  const out: DayData[] = [];
  for (let i = 0; i < 28; i++) {
    const d = addDays(TODAY, -i);
    const isSat = new Date(`${d}T12:00:00Z`).getUTCDay() === 6;
    out.push(
      day(d, isSat ? satNet : 30000, 600, { shifts: opts.shifts?.(d) ?? null }),
    );
  }
  return out;
}

describe("rule 1 · best day and shift", () => {
  it("shows the best weekday when it is ≥ 15% better per hour", () => {
    const r = bestDayAndShift(weeks(42000), [], TODAY);
    expect(r).toEqual([
      {
        id: "best-day",
        icon: "clock",
        title: "Sábado rende mais",
        body: "Cerca de 40% a mais por hora que nos outros dias.",
      },
    ]);
  });

  it("stays quiet below 15%", () => {
    expect(bestDayAndShift(weeks(34000), [], TODAY)).toEqual([]); // +13%
    expect(bestDayAndShift(weeks(34500), [], TODAY).map((x) => x.id)).toEqual([
      "best-day",
    ]); // +15%
  });

  it("needs 3 weeks of history and 2 samples per day", () => {
    const short = weeks(42000).filter((d) => d.date >= addDays(TODAY, -19));
    expect(bestDayAndShift(short, [], TODAY)).toEqual([]);
    const oneSaturday = weeks(42000).filter(
      (d) =>
        d.date >= addDays(TODAY, -6) ||
        new Date(`${d.date}T12:00:00Z`).getUTCDay() !== 6,
    );
    expect(bestDayAndShift(oneSaturday, [], TODAY)).toEqual([]);
    expect(bestDayAndShift([], [], TODAY)).toEqual([]);
  });

  it("finds the best shift from the optional shifts field", () => {
    const days = weeks(30000).map((d, i) => ({
      ...d,
      shifts: [i % 2 ? "night" : "morning"] as Shift[],
      earnings: [earn("uber", i % 2 ? 40000 : 30000)],
    }));
    const r = bestDayAndShift(days, [], TODAY);
    expect(r.find((x) => x.id === "best-shift")).toEqual({
      id: "best-shift",
      icon: "clock",
      title: "A madrugada rende mais",
      body: "Cerca de 35% a mais por hora que nos outros turnos.",
    });
  });

  it("ignores days without hours, days off, and a non-positive baseline", () => {
    const days = [
      ...weeks(42000),
      day(TODAY, 999999, null),
      day(TODAY, 0, 600, { isDayOff: true, earnings: [] }),
    ];
    expect(bestDayAndShift(days, [], TODAY)).toHaveLength(1);
    // Other days earn something but end negative after expenses: no meaningful baseline.
    const losing = weeks(42000).map((d) =>
      d.earnings[0]!.amountCents === 30000
        ? {
            ...d,
            earnings: [earn("uber", 1000)],
            expenses: [{ ...fuel(1, 1), amountCents: 5000 }],
          }
        : d,
    );
    expect(bestDayAndShift(losing, [], TODAY)).toEqual([]);
  });
});

describe("rule 2 · apps", () => {
  it("compares per hour with hours per app (this week)", () => {
    const r = appsInsight(
      [
        day("2026-11-28", 0, 480, {
          earnings: [earn("uber", 21545, 300), earn("99", 11250, 180)],
        }),
      ],
      TODAY,
    );
    expect(r).toEqual({
      id: "apps",
      icon: "trend",
      title: "Uber rendeu mais que a 99",
      body: "R$ 5,59 a mais por hora nesta semana.",
    });
  });
  it("names other apps and falls back to the share", () => {
    const r = appsInsight(
      [
        day("2026-11-28", 0, 480, {
          earnings: [
            earn("99", 6500),
            { ...earn("other", 3500), label: "inDrive" },
          ],
        }),
      ],
      TODAY,
    );
    expect(r?.title).toBe("99 trouxe a maior parte");
    expect(r?.body).toMatch(/^65% dos seus ganhos/);
    const other = appsInsight(
      [
        day("2026-11-28", 0, 480, {
          earnings: [
            { ...earn("other", 30000, 300), label: "inDrive" },
            earn("uber", 10000, 300),
          ],
        }),
      ],
      TODAY,
    );
    expect(other?.title).toBe("inDrive rendeu mais que a Uber");
    const vs99 = appsInsight(
      [
        day("2026-11-28", 0, 480, {
          earnings: [
            { ...earn("other", 30000, 300), label: "X" },
            earn("99", 10000, 300),
          ],
        }),
      ],
      TODAY,
    );
    expect(vs99?.title).toBe("X rendeu mais que a 99");
  });
  it("needs two apps this week and a difference", () => {
    expect(appsInsight([day("2026-11-28", 100)], TODAY)).toBeNull();
    expect(
      appsInsight(
        [
          day("2026-11-20", 0, 1, {
            earnings: [earn("uber", 1, 60), earn("99", 1, 60)],
          }),
        ],
        TODAY,
      ),
    ).toBeNull();
    expect(
      appsInsight(
        [
          day("2026-11-28", 0, 1, {
            earnings: [earn("uber", 100, 60), earn("99", 100, 60)],
          }),
        ],
        TODAY,
      ),
    ).toBeNull();
    const vsOther = appsInsight(
      [
        day("2026-11-28", 0, 480, {
          earnings: [
            earn("uber", 30000, 300),
            { ...earn("other", 100, 300), label: "Y" },
          ],
        }),
      ],
      TODAY,
    );
    expect(vsOther?.title).toBe("Uber rendeu mais que Y");
  });
});

describe("rule 3 · maintenance", () => {
  const oil: MaintenanceItem = {
    id: "m1",
    name: "Troca de óleo",
    intervalKm: 10000,
    lastDoneKm: 50000,
    lastDoneDate: "2026-10-01",
  };

  it("uses the odometer when available, else daily km since the date", () => {
    expect(
      kmSince(oil, [day("2026-11-20", 1, 1, { expenses: [fuel(30, 59000)] })]),
    ).toBe(9000);
    expect(
      kmSince(oil, [
        day("2026-09-30", 1, 1, { km: 500 }),
        day("2026-10-05", 1, 1, { km: 300 }),
        day("2026-10-06", 1, 1, { km: null }),
      ]),
    ).toBe(300);
    expect(
      kmSince({ ...oil, lastDoneDate: null }, [
        day("2026-10-05", 1, 1, { km: 300 }),
      ]),
    ).toBeNull();
    // Odometer below the last service (typo) → falls back to the date.
    expect(
      kmSince(oil, [
        day("2026-10-05", 1, 1, { km: 300, expenses: [fuel(30, 1000)] }),
      ]),
    ).toBe(300);
  });

  it("warns at ≤ 15% of the interval or ≤ 800 km", () => {
    const at = (odo: number, item = oil) =>
      maintenanceInsights(
        [item],
        [day("2026-11-20", 1, 1, { expenses: [fuel(30, odo)] })],
      );
    expect(at(58400)).toEqual([]); // 1.600 left (16%)
    expect(at(58500)[0]).toEqual({
      id: "maintenance-m1",
      icon: "wrench",
      title: "Troca de óleo chegando",
      body: "Faltam cerca de 1.500 km para a próxima.",
    });
    // Long interval: 900 km left is above the 800 km floor but within 15% → warn.
    expect(at(89100, { ...oil, intervalKm: 40000 })[0]?.body).toBe(
      "Faltam cerca de 900 km para a próxima.",
    );
  });

  it("uses the 800 km floor and handles overdue items", () => {
    const small = { ...oil, intervalKm: 3000 }; // 15% = 450 km, but 800 km floor applies
    expect(
      maintenanceInsights(
        [small],
        [day("2026-11-20", 1, 1, { expenses: [fuel(30, 52300)] })],
      )[0]?.body,
    ).toBe("Faltam cerca de 700 km para a próxima.");
    expect(
      maintenanceInsights(
        [oil],
        [day("2026-11-20", 1, 1, { expenses: [fuel(30, 60400)] })],
      )[0]?.body,
    ).toBe("Já passou cerca de 400 km do previsto. Vale agendar.");
    expect(
      maintenanceInsights(
        [oil],
        [day("2026-11-20", 1, 1, { expenses: [fuel(30, 60010)] })],
      )[0]?.body,
    ).toBe("Já passou cerca de 50 km do previsto. Vale agendar.");
    expect(
      maintenanceInsights(
        [{ ...oil, lastDoneDate: null, lastDoneKm: null }],
        [],
      ),
    ).toEqual([]);
  });

  it("finds the latest odometer", () => {
    expect(
      latestOdometer([
        day("2026-11-01", 1, 1, { expenses: [fuel(1, 100), fuel(1, 300)] }),
        day("2026-11-02", 1, 1, { expenses: [fuel(1, 200)] }),
      ]),
    ).toEqual({
      km: 300,
      date: "2026-11-01",
    });
    expect(latestOdometer([])).toBeNull();
  });
});

describe("rule 4 · reserve", () => {
  it("only with vehicle mode on and a positive value", () => {
    expect(reserveInsight(5077, true)).toEqual({
      id: "reserve",
      icon: "shield",
      title: "Reserva do carro",
      body: "Separe cerca de R$ 51 por dia rodado e fique tranquilo.",
    });
    expect(reserveInsight(5077, false)).toBeNull();
    expect(reserveInsight(null, true)).toBeNull();
    expect(reserveInsight(0, true)).toBeNull();
  });
});

describe("rule 5 · consumption (tank to tank)", () => {
  const tanks = (pairs: Array<[string, number, number, boolean?]>) =>
    pairs.map(([date, liters, odo, full = true]) =>
      day(date, 1, 1, { expenses: [fuel(liters, odo, full)] }),
    );

  it("computes km/l between full tanks, adding partial fills", () => {
    const series = tankToTank(
      fills(
        tanks([
          ["2026-11-01", 40, 10000],
          ["2026-11-03", 10, 10150, false],
          ["2026-11-05", 30, 10400],
          ["2026-11-06", 5, 10400],
        ]),
      ),
    );
    expect(series).toEqual([{ date: "2026-11-05", kmPerLiter: 10 }]);
  });

  it("warns when the last tank is > 10% worse than the 30-day average", () => {
    const base: Array<[string, number, number]> = [
      ["2026-11-05", 40, 10000],
      ["2026-11-10", 40, 10400],
      ["2026-11-15", 40, 10800],
    ];
    expect(
      consumptionInsight(tanks([...base, ["2026-11-20", 40, 11160]]), TODAY),
    ).toBeNull(); // 9,0 vs 10,0 = −10%
    expect(
      consumptionInsight(tanks([...base, ["2026-11-20", 40, 11150]]), TODAY),
    ).toEqual({
      id: "consumption",
      icon: "fuel",
      title: "O consumo piorou",
      body: "8,8 km/l no último tanque, contra 10,0 km/l na média recente. Vale olhar pneus e manutenção.",
    });
  });

  it("needs a previous tank inside the 30-day window and fuel with liters and odometer", () => {
    expect(
      consumptionInsight(
        tanks([
          ["2026-09-01", 40, 10000],
          ["2026-09-05", 40, 10400],
          ["2026-11-20", 40, 10700],
        ]),
        TODAY,
      ),
    ).toBeNull();
    expect(
      consumptionInsight(
        tanks([
          ["2026-11-01", 40, 10000],
          ["2026-11-05", 40, 10400],
        ]),
        TODAY,
      ),
    ).toBeNull();
    expect(
      fills([
        day("2026-11-01", 1, 1, {
          expenses: [
            { ...fuel(40, 1), liters: null },
            { ...fuel(40, 1), category: "food" },
          ],
        }),
      ]),
    ).toEqual([]);
  });
});

describe("rule 6 · week summary", () => {
  it("builds the sentence with variation and best day", () => {
    const days = [
      day("2026-11-27", 60000),
      day("2026-11-28", 92800),
      day("2026-11-21", 140000),
    ];
    expect(weekSummary(days, [], TODAY)).toEqual({
      netCents: 152800,
      text: [
        "9% a mais que no mesmo trecho da semana passada.",
        "Sábado foi o seu melhor dia.",
      ],
    });
  });
  it("keeps the first day when it is the best", () => {
    expect(
      weekSummary(
        [day("2026-11-27", 90000), day("2026-11-28", 10000)],
        [],
        TODAY,
      )?.text,
    ).toEqual(["Sexta foi o seu melhor dia."]);
  });
  it("is gentle when the week is behind, and handles a flat week", () => {
    expect(
      weekSummary(
        [day("2026-11-28", 50000), day("2026-11-21", 100000)],
        [],
        TODAY,
      )?.text,
    ).toEqual([
      "50% a menos que no mesmo trecho da semana passada. Semana que vem tem mais.",
    ]);
    expect(
      weekSummary(
        [day("2026-11-28", 50000), day("2026-11-21", 50000)],
        [],
        TODAY,
      )?.text,
    ).toEqual(["Igual ao mesmo trecho da semana passada."]);
  });
  it("is null without days driven this week; no comparison without last week", () => {
    expect(weekSummary([day("2026-11-21", 100000)], [], TODAY)).toBeNull();
    expect(weekSummary([day("2026-11-28", 100)], [], TODAY)?.text).toEqual([]);
  });
});

describe("rule 7 · rest", () => {
  const streak = (n: number, endOffset = 0) =>
    Array.from({ length: n }, (_, i) =>
      day(addDays(TODAY, -(i + endOffset)), 100),
    );
  it.each([
    [5, 0, null],
    [6, 0, 6],
    [8, 0, 8],
    [6, 1, 6],
    [6, 2, null],
  ])("%i days ending %i days ago → %s", (n, offset, expected) => {
    expect(restStreak(streak(n, offset), TODAY)).toBe(expected);
  });
  it("a day off breaks the streak", () => {
    const days = streak(7).map((d, i) =>
      i === 3 ? { ...d, isDayOff: true } : d,
    );
    expect(restStreak(days, TODAY)).toBeNull();
  });
});

describe("computeInsights", () => {
  it("orders rules and drops empty ones", () => {
    const r = computeInsights({
      days: weeks(42000),
      settings: [],
      today: TODAY,
      maintenance: [],
      reservePerDayDrivenCents: 5000,
      vehicleModeEnabled: true,
    });
    expect(r.map((x) => x.id)).toEqual(["best-day", "reserve"]);
    expect(INSIGHTS.restStreak).toBe(6);
  });
});
