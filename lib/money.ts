/**
 * Money helpers. All amounts are integer cents (BRL). Never floats.
 * Formatting is done by hand (not Intl) so output is deterministic across
 * runtimes: Intl inserts a non-breaking space after "R$" in some engines.
 */

export type Cents = number;

const MAX_CENTS = 100_000_000_00; // R$ 100 milhões: sanity ceiling for input.

export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Parses what a driver types into cents.
 * Accepts "212,50", "1.528,00", "212.50" (dot keyboards), "40", "R$ 98,00".
 * Rule: with a comma, the comma is the decimal separator and dots group
 * thousands. Without a comma, a dot followed by 1–2 digits at the end is a
 * decimal separator; otherwise dots group thousands.
 * Returns null for empty, negative or malformed input.
 */
export function parseBRL(input: string): Cents | null {
  const raw = input.replace(/R\$/i, "").replace(/\s/g, "");
  if (raw === "") return null;
  if (!/^[\d.,]+$/.test(raw)) return null;

  let intPart: string;
  let fracPart = "";

  if (raw.includes(",")) {
    const parts = raw.split(",");
    if (parts.length !== 2) return null;
    [intPart, fracPart] = parts as [string, string];
    if (!isValidThousands(intPart)) return null;
    intPart = intPart.replace(/\./g, "");
  } else {
    const decimalDot = raw.match(/^(.*)\.(\d{1,2})$/);
    if (decimalDot && !decimalDot[1]!.includes(".")) {
      intPart = decimalDot[1]!;
      fracPart = decimalDot[2]!;
    } else {
      if (!isValidThousands(raw)) return null;
      intPart = raw.replace(/\./g, "");
    }
  }

  if (fracPart.length > 2) return null;
  if (intPart === "" && fracPart === "") return null;

  const cents =
    Number(intPart === "" ? "0" : intPart) * 100 +
    Number(fracPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null;
  return cents;
}

function isValidThousands(s: string): boolean {
  if (!s.includes(".")) return /^\d*$/.test(s);
  return /^\d{1,3}(\.\d{3})+$/.test(s);
}

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export type FormatOptions = {
  /** Show ",00". Default true. */
  cents?: boolean;
  /** Prefix with "R$ ". Default true. */
  symbol?: boolean;
};

/** 152800 → "R$ 1.528,00". Without cents the value is rounded half-up. */
export function formatBRL(value: Cents, options: FormatOptions = {}): string {
  const { cents = true, symbol = true } = options;
  const negative = value < 0;
  const abs = Math.abs(value);
  let body: string;
  if (cents) {
    body = `${groupThousands(Math.floor(abs / 100))},${String(abs % 100).padStart(2, "0")}`;
  } else {
    body = groupThousands(Math.round(abs / 100));
  }
  const sign = negative ? "− " : "";
  return `${sign}${symbol ? "R$ " : ""}${body}`;
}

/** For the hero value: 640000 → { integer: "6.400", cents: "00" }. */
export function splitBRL(value: Cents): {
  negative: boolean;
  integer: string;
  cents: string;
} {
  const abs = Math.abs(value);
  return {
    negative: value < 0,
    integer: groupThousands(Math.floor(abs / 100)),
    cents: String(abs % 100).padStart(2, "0"),
  };
}

/** Value as the user would type it back into an input: 21250 → "212,50". */
export function toInputBRL(value: Cents | null | undefined): string {
  if (value == null) return "";
  return formatBRL(value, { symbol: false });
}

/** Integer division rounding half away from zero. Returns null when the divisor is not positive. */
export function divideRound(numerator: number, divisor: number): number | null {
  if (!(divisor > 0) || !Number.isFinite(divisor)) return null;
  const q = numerator / divisor;
  const rounded = Math.round(Math.abs(q));
  return q < 0 ? -rounded : rounded;
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** 0.716 → "71,6%". Integers drop the decimal: 0.8 → "80%". */
export function formatPercent(ratio: number, maxFractionDigits = 1): string {
  const factor = 10 ** maxFractionDigits;
  const pct = Math.round(ratio * 100 * factor) / factor;
  const [i, f] = String(Math.abs(pct)).split(".");
  const sign = pct < 0 ? "−" : "";
  return `${sign}${i}${f ? `,${f}` : ""}%`;
}
