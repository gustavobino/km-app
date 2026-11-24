/** RFC 4180 CSV with ";" separator and BOM, so Excel in pt-BR opens it correctly. */
export type Cell = string | number | boolean | null | undefined;

const SEP = ";";

function cell(value: Cell): string {
  if (value == null) return "";
  const s =
    typeof value === "boolean" ? (value ? "sim" : "não") : String(value);
  // Neutralize spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly Cell[])[],
): string {
  const lines = [
    headers.map(cell).join(SEP),
    ...rows.map((r) => r.map(cell).join(SEP)),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** 21250 → "212,50" (cents as a pt-BR decimal for spreadsheets). */
export function centsCell(cents: number | null | undefined): string {
  if (cents == null) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}
