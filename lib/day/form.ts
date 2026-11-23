/**
 * "Registrar o dia" form logic: raw text fields ⇄ a validated day.
 * Pure functions; the screen only renders and calls these.
 */
import type { LocalDate } from "../dates";
import { parseBRL, toInputBRL } from "../money";
import { summarize, type Summary } from "../metrics/core";
import type {
  DayData,
  Earning,
  Expense,
  ExpenseCategory,
  PlatformSetting,
  Shift,
  Source,
} from "../metrics/types";
import { formatHoursDecimal, parseHours, parseKm } from "../units";

export type EarningRow = {
  key: string;
  source: Source;
  /** App name for "other". */
  label: string;
  /** Row added on this screen: the name is editable. */
  custom: boolean;
  amount: string;
  /** Per-app hours (only used with "dividir horas entre apps"). */
  hours: string;
};

export type ExpenseEntry = {
  key: string;
  category: ExpenseCategory;
  label: string;
  amount: string;
  liters: string;
  odometer: string;
  fullTank: boolean;
};

export type DayForm = {
  date: LocalDate;
  earnings: EarningRow[];
  hours: string;
  km: string;
  expenses: ExpenseEntry[];
  isDayOff: boolean;
  shifts: Shift[];
  splitHours: boolean;
  note: string;
};

export type StoredEarning = Earning & { id: string };
export type StoredExpense = Expense & { id: string };
export type StoredDay = Omit<DayData, "earnings" | "expenses"> & {
  id: string;
  note: string | null;
  earnings: StoredEarning[];
  expenses: StoredExpense[];
};

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  fuel: "Combustível",
  food: "Alimentação",
  toll: "Pedágio",
  parking: "Estacionamento",
  wash: "Lavagem",
  other: "Outro",
};

export const SHIFT_LABELS: Record<Shift, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
  night: "Madrugada",
};

export function appLabel(source: Source, label: string | null): string {
  if (source === "uber") return "Uber";
  if (source === "99") return "99";
  return label?.trim() || "Outro app";
}

let keySeq = 0;
/** Stable-enough React keys for rows created on the client. */
export function newKey(prefix = "k"): string {
  keySeq += 1;
  return `${prefix}${keySeq}`;
}

function earningRow(
  source: Source,
  label: string | null,
  custom = false,
): EarningRow {
  return {
    key: newKey("e"),
    source,
    label: label ?? "",
    custom,
    amount: "",
    hours: "",
  };
}

/**
 * Earnings rows from the apps chosen in onboarding ("uber", "99", free names).
 * Without an answer, show Uber, 99 and an "Outro app" row (as in the reference).
 */
export function defaultEarningRows(apps: readonly string[]): EarningRow[] {
  if (apps.length === 0) {
    return [
      earningRow("uber", null),
      earningRow("99", null),
      earningRow("other", null, true),
    ];
  }
  return apps.map((app) =>
    app === "uber"
      ? earningRow("uber", null)
      : app === "99"
        ? earningRow("99", null)
        : earningRow("other", app),
  );
}

export function emptyForm(date: LocalDate, apps: readonly string[]): DayForm {
  return {
    date,
    earnings: defaultEarningRows(apps),
    hours: "",
    km: "",
    expenses: [],
    isDayOff: false,
    shifts: [],
    splitHours: false,
    note: "",
  };
}

function sameRow(row: EarningRow, e: StoredEarning): boolean {
  if (row.source !== e.source) return false;
  if (e.source !== "other") return true;
  return (
    row.label.trim().toLocaleLowerCase("pt-BR") ===
    (e.label ?? "").trim().toLocaleLowerCase("pt-BR")
  );
}

/** Pre-fills the form with a saved day (editing). */
export function formFromDay(day: StoredDay, apps: readonly string[]): DayForm {
  const rows = defaultEarningRows(apps);
  const used = new Set<EarningRow>();
  for (const e of day.earnings) {
    let row = rows.find((r) => !used.has(r) && !r.amount && sameRow(r, e));
    if (!row && e.source === "other") {
      // An unnamed "Outro app" row can take a named app.
      row = rows.find((r) => !used.has(r) && !r.amount && r.custom && !r.label);
      if (row) row.label = e.label ?? "";
    }
    if (!row) {
      row = earningRow(e.source, e.label, e.source === "other");
      rows.push(row);
    }
    used.add(row);
    row.amount = toInputBRL(e.amountCents);
    row.hours = e.minutes != null ? formatHoursDecimal(e.minutes) : "";
  }
  return {
    date: day.date,
    earnings: rows,
    hours: day.minutes != null ? formatHoursDecimal(day.minutes) : "",
    km: day.km != null ? String(day.km) : "",
    expenses: day.expenses.map((x) => ({
      key: newKey("x"),
      category: x.category,
      label: x.label ?? "",
      amount: toInputBRL(x.amountCents),
      liters: x.liters != null ? String(x.liters).replace(".", ",") : "",
      odometer: x.odometerKm != null ? String(x.odometerKm) : "",
      fullTank: x.fullTank ?? false,
    })),
    isDayOff: day.isDayOff,
    shifts: day.shifts ?? [],
    splitHours: day.earnings.some((e) => e.minutes != null),
    note: day.note ?? "",
  };
}

/** Liters: "14,2" / "14.25" → 14.2 / 14.25 (up to 3 decimals). */
export function parseLiters(input: string): number | null {
  const raw = input.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

export type FieldErrors = Record<string, string>;

export type ParseResult =
  | { ok: true; day: Omit<StoredDay, "id">; errors: FieldErrors }
  | { ok: false; errors: FieldErrors };

type IdFactory = () => string;

/**
 * Validates the form. Field error keys: "earning:<key>", "earningHours:<key>",
 * "hours", "km", "expense:<key>", "liters:<key>", "odometer:<key>", "form".
 */
export function parseDayForm(form: DayForm, newId: IdFactory): ParseResult {
  const errors: FieldErrors = {};
  const earnings: StoredEarning[] = [];
  const expenses: StoredExpense[] = [];

  let minutes: number | null = null;
  let km: number | null = null;

  if (!form.isDayOff) {
    for (const row of form.earnings) {
      if (!row.amount.trim()) continue;
      const cents = parseBRL(row.amount);
      if (cents == null) {
        errors[`earning:${row.key}`] = "Valor inválido. Exemplo: 212,50";
        continue;
      }
      let rowMinutes: number | null = null;
      if (form.splitHours && row.hours.trim()) {
        rowMinutes = parseHours(row.hours);
        if (rowMinutes == null)
          errors[`earningHours:${row.key}`] = "Horas inválidas. Exemplo: 4,5";
      }
      if (cents === 0 && rowMinutes == null) continue;
      earnings.push({
        id: newId(),
        source: row.source,
        label:
          row.source === "other" ? row.label.trim().slice(0, 40) || null : null,
        amountCents: cents,
        minutes: rowMinutes,
      });
    }

    if (form.hours.trim()) {
      minutes = parseHours(form.hours);
      if (minutes == null)
        errors.hours = "Horas inválidas. Exemplo: 8,5 ou 8h30";
    } else if (form.splitHours) {
      const split = earnings
        .map((e) => e.minutes ?? 0)
        .reduce((a, b) => a + b, 0);
      minutes = split > 0 ? Math.min(split, 24 * 60) : null;
    }

    if (form.km.trim()) {
      km = parseKm(form.km);
      if (km == null || km > 3000)
        errors.km = "Km inválido. Use só números, ex.: 142";
    }
  }

  for (const x of form.expenses) {
    const cents = parseBRL(x.amount);
    if (cents == null || cents === 0) {
      errors[`expense:${x.key}`] = "Informe o valor. Exemplo: 85,00";
      continue;
    }
    let liters: number | null = null;
    let odometerKm: number | null = null;
    if (x.category === "fuel") {
      if (x.liters.trim()) {
        liters = parseLiters(x.liters);
        if (liters == null)
          errors[`liters:${x.key}`] = "Litros inválidos. Exemplo: 32,5";
      }
      if (x.odometer.trim()) {
        odometerKm = parseKm(x.odometer);
        if (odometerKm == null)
          errors[`odometer:${x.key}`] = "Use só números, ex.: 52340";
      }
    }
    expenses.push({
      id: newId(),
      category: x.category,
      label: x.label.trim().slice(0, 40) || null,
      amountCents: cents,
      liters,
      odometerKm,
      fullTank: x.category === "fuel" ? x.fullTank : null,
    });
  }

  if (
    !form.isDayOff &&
    earnings.length === 0 &&
    expenses.length === 0 &&
    Object.keys(errors).length === 0
  ) {
    errors.form = "Informe pelo menos um ganho, ou marque como dia de folga.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors,
    day: {
      date: form.date,
      minutes,
      km,
      isDayOff: form.isDayOff,
      shifts:
        form.isDayOff || form.shifts.length === 0 ? null : [...form.shifts],
      note: form.note.trim().slice(0, 500) || null,
      earnings,
      expenses,
    },
  };
}

/**
 * The live "Sobrou no bolso hoje" while typing: lenient (invalid fields count
 * as empty), so the number never jumps to an error state.
 */
export function liveSummary(
  form: DayForm,
  settings: readonly PlatformSetting[],
): Summary {
  const earnings: Earning[] = form.isDayOff
    ? []
    : form.earnings.map((r) => ({
        source: r.source,
        label: r.label || null,
        amountCents: parseBRL(r.amount) ?? 0,
        minutes: null,
      }));
  const expenses: Expense[] = form.expenses.map((x) => ({
    category: x.category,
    label: null,
    amountCents: parseBRL(x.amount) ?? 0,
    liters: null,
    odometerKm: null,
    fullTank: null,
  }));
  let minutes = form.isDayOff ? null : parseHours(form.hours);
  if (minutes == null && form.splitHours && !form.isDayOff) {
    const split = form.earnings
      .map((r) => parseHours(r.hours) ?? 0)
      .reduce((a, b) => a + b, 0);
    minutes = split > 0 ? split : null;
  }
  const data: DayData = {
    date: form.date,
    minutes,
    km: form.isDayOff ? null : parseKm(form.km),
    isDayOff: form.isDayOff,
    shifts: null,
    earnings,
    expenses,
  };
  return summarize([data], settings, [form.date]);
}
