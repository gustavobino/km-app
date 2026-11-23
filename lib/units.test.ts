import { describe, expect, it } from "vitest";
import {
  formatHoursDecimal,
  formatHoursFromDecimal,
  formatHoursMinutes,
  formatKm,
  parseHours,
  parseKm,
} from "./units";

describe("parseHours", () => {
  it.each([
    ["8,5", 510],
    ["8.5", 510],
    ["8", 480],
    ["8h", 480],
    ["8h30", 510],
    ["8:30", 510],
    ["10h15", 615],
    ["8,25", 495],
    ["0", 0],
    ["24", 1440],
    [" 6 h ", 360],
  ])("%s → %i min", (input, expected) => {
    expect(parseHours(input)).toBe(expected);
  });

  it.each(["", "abc", "8h75", "25", "24h30", "-1", "8,5,5"])(
    "rejects %j",
    (input) => {
      expect(parseHours(input)).toBeNull();
    },
  );
});

describe("format hours", () => {
  it("formats as XhMM (simulator format)", () => {
    expect(formatHoursMinutes(615)).toBe("10h15");
    expect(formatHoursMinutes(480)).toBe("8h00");
    expect(formatHoursFromDecimal(13.3333)).toBe("13h20");
    expect(formatHoursFromDecimal(11.1111)).toBe("11h07");
    expect(formatHoursFromDecimal(10.2564)).toBe("10h15");
    expect(formatHoursFromDecimal(9.9999)).toBe("10h00");
  });
  it("formats as decimal for inputs", () => {
    expect(formatHoursDecimal(510)).toBe("8,5");
    expect(formatHoursDecimal(480)).toBe("8");
    expect(formatHoursDecimal(525)).toBe("8,75");
  });
});

describe("km", () => {
  it.each([
    ["142", 142],
    ["1.420", 1420],
    ["142 km", 142],
    ["142km", 142],
  ])("%s → %i", (input, expected) => {
    expect(parseKm(input)).toBe(expected);
  });
  it.each(["", "14,2", "abc", "1.42"])("rejects %j", (input) => {
    expect(parseKm(input)).toBeNull();
  });
  it("formats", () => {
    expect(formatKm(880)).toBe("880");
    expect(formatKm(12500)).toBe("12.500");
  });
});
