import { describe, expect, it } from "vitest";
import {
  divideRound,
  formatBRL,
  formatPercent,
  isCents,
  parseBRL,
  splitBRL,
  sumCents,
  toInputBRL,
} from "./money";

describe("parseBRL", () => {
  it.each([
    ["212,50", 21250],
    ["98,00", 9800],
    ["40", 4000],
    ["40,5", 4050],
    ["1.528,00", 152800],
    ["10.000", 1000000],
    ["212.50", 21250],
    ["212.5", 21250],
    ["R$ 98,00", 9800],
    [" 85 ", 8500],
    [",50", 50],
    ["0", 0],
  ])("%s → %i", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each([
    "",
    "  ",
    "abc",
    "-10",
    "1,2,3",
    "12,345",
    "1.52,00",
    "10.00.00",
    "1e5",
  ])("rejects %j", (input) => {
    expect(parseBRL(input)).toBeNull();
  });

  it("rejects absurd values", () => {
    expect(parseBRL("999999999999")).toBeNull();
  });
});

describe("formatBRL", () => {
  it.each([
    [35050, "R$ 350,50"],
    [152800, "R$ 1.528,00"],
    [894000, "R$ 8.940,00"],
    [5, "R$ 0,05"],
    [0, "R$ 0,00"],
    [100000000, "R$ 1.000.000,00"],
    [-10700, "− R$ 107,00"],
  ])("%i → %s", (cents, expected) => {
    expect(formatBRL(cents)).toBe(expected);
  });

  it("can drop cents (rounded) and symbol", () => {
    expect(formatBRL(160000, { cents: false })).toBe("R$ 1.600");
    expect(formatBRL(22857, { cents: false })).toBe("R$ 229");
    expect(formatBRL(21250, { symbol: false })).toBe("212,50");
  });
});

describe("splitBRL / toInputBRL", () => {
  it("splits the hero value", () => {
    expect(splitBRL(640000)).toEqual({
      negative: false,
      integer: "6.400",
      cents: "00",
    });
    expect(splitBRL(-24350)).toEqual({
      negative: true,
      integer: "243",
      cents: "50",
    });
  });
  it("round-trips input", () => {
    expect(toInputBRL(21250)).toBe("212,50");
    expect(toInputBRL(null)).toBe("");
    expect(parseBRL(toInputBRL(152800))).toBe(152800);
  });
});

describe("divideRound", () => {
  it("rounds half away from zero", () => {
    expect(divideRound(5, 2)).toBe(3);
    expect(divideRound(-5, 2)).toBe(-3);
    expect(divideRound(4, 3)).toBe(1);
  });
  it("matches CLAUDE.md examples", () => {
    // day: 350,50 / 8,5 h = 41,24; 350,50 / 142 km = 2,47
    expect(divideRound(35050, 8.5)).toBe(4124);
    expect(divideRound(35050, 142)).toBe(247);
    // week: 2.140,00 / 52 h = 41,15; / 880 km = 2,43
    expect(divideRound(214000, 52)).toBe(4115);
    expect(divideRound(214000, 880)).toBe(243);
  });
  it("returns null on non-positive divisors", () => {
    expect(divideRound(100, 0)).toBeNull();
    expect(divideRound(100, -1)).toBeNull();
    expect(divideRound(100, Number.NaN)).toBeNull();
    expect(divideRound(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("misc", () => {
  it("sums and checks cents", () => {
    expect(sumCents([21250, 9800, 4000])).toBe(35050);
    expect(sumCents([])).toBe(0);
    expect(isCents(100)).toBe(true);
    expect(isCents(1.5)).toBe(false);
    expect(isCents("1")).toBe(false);
  });
  it("formats percent", () => {
    expect(formatPercent(0.716)).toBe("71,6%");
    expect(formatPercent(0.8)).toBe("80%");
    expect(formatPercent(0.6667, 0)).toBe("67%");
    expect(formatPercent(-0.05)).toBe("−5%");
  });
});
