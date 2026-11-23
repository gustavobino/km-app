/**
 * Calendar helpers. A "LocalDate" is an ISO "YYYY-MM-DD" string that means a
 * calendar day in America/Sao_Paulo. Arithmetic is done on UTC midnight of
 * that day, so it never depends on the device timezone or DST.
 * Weeks run Monday → Sunday.
 */

export const TIME_ZONE = "America/Sao_Paulo";

export type LocalDate = string;
export type DateRange = { start: LocalDate; end: LocalDate };

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAYS_LONG = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];
const WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function isLocalDate(value: string): value is LocalDate {
  const m = value.match(ISO_RE);
  if (!m) return false;
  const d = toUTC(value);
  return (
    d.getUTCDate() === Number(m[3]) && d.getUTCMonth() + 1 === Number(m[2])
  );
}

function toUTC(date: LocalDate): Date {
  const m = date.match(ISO_RE);
  if (!m) throw new Error(`Invalid LocalDate: ${date}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function fromUTC(d: Date): LocalDate {
  return d.toISOString().slice(0, 10);
}

/** The calendar day in São Paulo for a given instant. */
export function toLocalDate(instant: Date): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function today(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/** Inclusive number of days from start to end (same day → 1). */
export function daysBetweenInclusive(start: LocalDate, end: LocalDate): number {
  return (
    Math.round((toUTC(end).getTime() - toUTC(start).getTime()) / 86_400_000) + 1
  );
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: LocalDate): number {
  return (toUTC(date).getUTCDay() + 6) % 7;
}

export function weekRange(date: LocalDate): DateRange {
  const start = addDays(date, -weekdayIndex(date));
  return { start, end: addDays(start, 6) };
}

export function daysInMonth(date: LocalDate): number {
  const d = toUTC(date);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

export function monthRange(date: LocalDate): DateRange {
  const start = `${date.slice(0, 7)}-01`;
  return {
    start,
    end: `${date.slice(0, 7)}-${String(daysInMonth(date)).padStart(2, "0")}`,
  };
}

export function dayRange(date: LocalDate): DateRange {
  return { start: date, end: date };
}

/** The range of the same length immediately before. */
export function previousRange(
  range: DateRange,
  kind: "day" | "week" | "month",
): DateRange {
  if (kind === "month") return monthRange(addDays(range.start, -1));
  const len = daysBetweenInclusive(range.start, range.end);
  return { start: addDays(range.start, -len), end: addDays(range.start, -1) };
}

/** Days left in the month, including `date` itself. */
export function remainingDaysInMonth(date: LocalDate): number {
  return daysInMonth(date) - Number(date.slice(8, 10)) + 1;
}

export function eachDay(range: DateRange): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isWithin(date: LocalDate, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/** "Segunda, 23 de novembro". */
export function formatLongDate(date: LocalDate): string {
  const d = toUTC(date);
  return `${WEEKDAYS_LONG[weekdayIndex(date)]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

/** "Seg". */
export function formatWeekdayShort(date: LocalDate): string {
  return WEEKDAYS_SHORT[weekdayIndex(date)]!;
}

export function formatWeekdayLong(date: LocalDate): string {
  return WEEKDAYS_LONG[weekdayIndex(date)]!;
}

/** "Novembro de 2026". */
export function formatMonthYear(date: LocalDate): string {
  const d = toUTC(date);
  const month = MONTHS[d.getUTCMonth()]!;
  return `${month[0]!.toUpperCase()}${month.slice(1)} de ${d.getUTCFullYear()}`;
}

/** "novembro". */
export function formatMonthName(date: LocalDate): string {
  return MONTHS[toUTC(date).getUTCMonth()]!;
}

/**
 * "23 a 29 de novembro"; across months "30 de novembro a 6 de dezembro";
 * across years "29 de dezembro de 2025 a 4 de janeiro de 2026".
 */
export function formatRange(range: DateRange): string {
  const s = toUTC(range.start);
  const e = toUTC(range.end);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth();
  const endTxt = `${e.getUTCDate()} de ${MONTHS[e.getUTCMonth()]}`;
  if (sameMonth) return `${s.getUTCDate()} a ${endTxt}`;
  if (sameYear)
    return `${s.getUTCDate()} de ${MONTHS[s.getUTCMonth()]} a ${endTxt}`;
  return `${s.getUTCDate()} de ${MONTHS[s.getUTCMonth()]} de ${s.getUTCFullYear()} a ${endTxt} de ${e.getUTCFullYear()}`;
}
