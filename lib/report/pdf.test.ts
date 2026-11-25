import { describe, expect, it } from "vitest";
import { buildEarningsReport } from "./earnings";
import { pdfSafe, renderEarningsPdf, wrapText } from "./pdf";
import type { DayData } from "../metrics/types";

const day = (date: string, cents: number): DayData => ({
  date,
  minutes: null,
  km: null,
  isDayOff: false,
  shifts: null,
  earnings: [
    { source: "uber", label: null, amountCents: cents, minutes: null },
    { source: "other", label: "inDrive", amountCents: 1000, minutes: null },
  ],
  expenses: [],
});

describe("pdfSafe", () => {
  it("keeps Portuguese accents and swaps characters the PDF fonts lack", () => {
    expect(pdfSafe("Relatório − ação · março R$ 1")).toBe(
      "Relatório - ação · março R$ 1",
    );
    expect(pdfSafe("ok 🚗")).toBe("ok ");
  });
});

describe("wrapText", () => {
  const font = { widthOfTextAtSize: (t: string) => t.length };
  it("breaks lines at the width", () => {
    expect(wrapText("um dois tres quatro", font, 10, 9)).toEqual([
      "um dois",
      "tres",
      "quatro",
    ]);
    expect(wrapText("", font, 10, 9)).toEqual([]);
  });
});

describe("renderEarningsPdf", () => {
  it("creates a PDF for 12 months, with and without a name", async () => {
    const days = Array.from({ length: 12 }, (_, i) =>
      day(`2026-${String(i + 1).padStart(2, "0")}-10`, 100_000 + i * 1000),
    );
    const report = buildEarningsReport(days, "year", [], "2026-12-20");
    const bytes = await renderEarningsPdf({
      report,
      driverName: "Maria da Silva",
      generatedOn: "20/12/2026",
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const empty = await renderEarningsPdf({
      report: buildEarningsReport([], "3m", [], "2026-12-20"),
      driverName: " ",
      generatedOn: "20/12/2026",
    });
    expect(empty.length).toBeGreaterThan(500);
  });
});
