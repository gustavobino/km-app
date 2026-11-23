import { describe, expect, it } from "vitest";
import { monthReserve } from "./month-reserve";
import type { DayData } from "./types";

const day = (date: string, km: number, cents: number): DayData => ({
  date,
  minutes: null,
  km,
  isDayOff: false,
  shifts: null,
  earnings: [
    { source: "uber", label: null, amountCents: cents, minutes: null },
  ],
  expenses: [],
});

describe("monthReserve", () => {
  it("uses only this month's km and net, with 90 days of history for the estimate", () => {
    const days = [
      day("2026-11-10", 1000, 300000),
      day("2026-11-20", 2000, 340000),
      day("2026-10-20", 500, 999999),
    ];
    const r = monthReserve(
      days,
      "2026-11-23",
      {
        ownership: "own",
        vehicle: {
          category: "compact",
          year: 2021,
          rentCents: null,
          rentPeriod: null,
          installmentCents: null,
          insuranceYearCents: null,
          ipvaYearCents: null,
          maintenanceCentsPerKm: 30,
          tiresCentsPerKm: 14,
        },
        reference: [],
        typicalDaysPerMonth: 24,
      },
      [],
    );
    expect(r.netCents).toBe(640000);
    expect(r.reserve).toMatchObject({
      km: 3000,
      reserveCents: 132000,
      freeAfterReserveCents: 508000,
      perDayDrivenCents: 66000,
    });
  });
});
