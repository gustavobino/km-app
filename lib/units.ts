/**
 * Hours are stored as integer minutes and km as integer kilometres,
 * for the same reason money is stored in cents: no float drift.
 */

export type Minutes = number;

const MAX_MINUTES_PER_DAY = 24 * 60;

/**
 * Parses hours typed by the driver into minutes.
 * Accepts "8,5", "8.5", "8", "8h30", "8h", "8:30", "10h15".
 * Returns null for empty, malformed or > 24 h input.
 */
export function parseHours(input: string): Minutes | null {
  const raw = input.trim().toLowerCase().replace(/\s/g, "");
  if (raw === "") return null;

  let minutes: number;
  const hm = raw.match(/^(\d{1,2})(?:h|:)(\d{0,2})(?:min)?$/);
  if (hm) {
    const h = Number(hm[1]);
    const m = hm[2] === "" ? 0 : Number(hm[2]);
    if (m >= 60) return null;
    minutes = h * 60 + m;
  } else {
    const dec = raw.match(/^(\d{1,2})(?:[.,](\d{1,2}))?h?$/);
    if (!dec) return null;
    const value = Number(`${dec[1]}.${dec[2] ?? "0"}`);
    minutes = Math.round(value * 60);
  }
  if (minutes > MAX_MINUTES_PER_DAY) return null;
  return minutes;
}

/** 615 → "10h15"; 480 → "8h00". Rounds to the nearest minute. */
export function formatHoursMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Hours (float) → "10h15". Used by the simulator outputs. */
export function formatHoursFromDecimal(hours: number): string {
  return formatHoursMinutes(hours * 60);
}

/** 510 → "8,5"; 480 → "8"; 525 → "8,75". For pre-filling inputs and short labels. */
export function formatHoursDecimal(minutes: Minutes): string {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return String(hours).replace(".", ",");
}

/** Parses km: "142", "1.420" (thousands dot), "142 km". Integers only. */
export function parseKm(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/km$/, "").replace(/\s/g, "");
  if (raw === "") return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ""));
  return null;
}

/** 1420 → "1.420". */
export function formatKm(km: number): string {
  return String(Math.round(km)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
