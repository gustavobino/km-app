import { describe, expect, it } from "vitest";
import {
  addDays,
  dayRange,
  daysBetweenInclusive,
  daysInMonth,
  eachDay,
  formatLongDate,
  formatMonthName,
  formatMonthYear,
  formatRange,
  formatWeekdayLong,
  formatWeekdayShort,
  isLocalDate,
  isWithin,
  monthRange,
  previousRange,
  remainingDaysInMonth,
  toLocalDate,
  today,
  weekdayIndex,
  weekRange,
} from "./dates";

describe("toLocalDate (America/Sao_Paulo)", () => {
  it("uses São Paulo's calendar day, not UTC", () => {
    // 02:30 UTC on the 24th is still 23:30 on the 23rd in São Paulo (UTC−3).
    expect(toLocalDate(new Date("2026-11-24T02:30:00Z"))).toBe("2026-11-23");
    expect(toLocalDate(new Date("2026-11-24T03:00:00Z"))).toBe("2026-11-24");
    expect(today(new Date("2026-01-01T12:00:00Z"))).toBe("2026-01-01");
  });
});

describe("arithmetic", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("counts inclusive days", () => {
    expect(daysBetweenInclusive("2026-11-23", "2026-11-23")).toBe(1);
    expect(daysBetweenInclusive("2026-11-23", "2026-11-29")).toBe(7);
  });
  it("validates dates", () => {
    expect(isLocalDate("2026-11-23")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("23/11/2026")).toBe(false);
  });
});

describe("weeks run Monday → Sunday", () => {
  it("indexes weekdays", () => {
    expect(weekdayIndex("2026-11-23")).toBe(0); // Monday
    expect(weekdayIndex("2026-11-29")).toBe(6); // Sunday
  });
  it.each([
    ["2026-11-23", "2026-11-23", "2026-11-29"],
    ["2026-11-29", "2026-11-23", "2026-11-29"],
    ["2026-12-02", "2026-11-30", "2026-12-06"],
  ])("week of %s is %s..%s", (date, start, end) => {
    expect(weekRange(date)).toEqual({ start, end });
  });
});

describe("months", () => {
  it("knows month lengths", () => {
    expect(daysInMonth("2026-11-10")).toBe(30);
    expect(daysInMonth("2026-02-10")).toBe(28);
    expect(daysInMonth("2028-02-10")).toBe(29);
    expect(monthRange("2026-11-23")).toEqual({
      start: "2026-11-01",
      end: "2026-11-30",
    });
  });
  it("counts remaining days including today", () => {
    expect(remainingDaysInMonth("2026-11-24")).toBe(7);
    expect(remainingDaysInMonth("2026-11-30")).toBe(1);
    expect(remainingDaysInMonth("2026-11-01")).toBe(30);
  });
});

describe("ranges", () => {
  it("computes previous ranges", () => {
    expect(previousRange(dayRange("2026-11-23"), "day")).toEqual({
      start: "2026-11-22",
      end: "2026-11-22",
    });
    expect(previousRange(weekRange("2026-11-23"), "week")).toEqual({
      start: "2026-11-16",
      end: "2026-11-22",
    });
    expect(previousRange(monthRange("2026-03-15"), "month")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });
  it("iterates and checks membership", () => {
    expect(eachDay({ start: "2026-11-29", end: "2026-12-01" })).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
    ]);
    expect(isWithin("2026-11-25", weekRange("2026-11-23"))).toBe(true);
    expect(isWithin("2026-11-30", weekRange("2026-11-23"))).toBe(false);
  });
});

describe("pt-BR labels", () => {
  it("formats as in the reference screens", () => {
    expect(formatLongDate("2026-11-23")).toBe("Segunda, 23 de novembro");
    expect(formatMonthYear("2026-11-23")).toBe("Novembro de 2026");
    expect(formatMonthName("2026-03-01")).toBe("março");
    expect(formatWeekdayShort("2026-11-28")).toBe("Sáb");
    expect(formatWeekdayLong("2026-11-27")).toBe("Sexta");
  });
  it.each([
    [{ start: "2026-11-23", end: "2026-11-29" }, "23 a 29 de novembro"],
    [
      { start: "2026-11-30", end: "2026-12-06" },
      "30 de novembro a 6 de dezembro",
    ],
    [
      { start: "2025-12-29", end: "2026-01-04" },
      "29 de dezembro de 2025 a 4 de janeiro de 2026",
    ],
  ])("formats range %j", (range, expected) => {
    expect(formatRange(range)).toBe(expected);
  });
});
