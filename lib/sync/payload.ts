/** Conversions between the device's LocalDay and the server's snake_case rows. */
import type { LocalDay } from "../local/db";
import type { DayPayload } from "../schemas/day";
import type { ExpenseCategory, Shift, Source } from "../metrics/types";

export function toPayload(day: LocalDay): DayPayload {
  return {
    id: day.id,
    date: day.date,
    minutes: day.minutes,
    km: day.km,
    is_day_off: day.isDayOff,
    shifts: day.shifts,
    note: day.note,
    client_updated_at: day.clientUpdatedAt,
    earnings: day.earnings.map((e) => ({
      id: e.id,
      source: e.source,
      label: e.label,
      amount_cents: e.amountCents,
      minutes: e.minutes,
    })),
    expenses: day.expenses.map((x) => ({
      id: x.id,
      category: x.category,
      label: x.label,
      amount_cents: x.amountCents,
      liters: x.liters,
      odometer_km: x.odometerKm,
      full_tank: x.fullTank,
    })),
  };
}

/** A row from `days` with embedded `earnings` and `expenses`, as PostgREST returns it. */
export type RemoteDayRow = {
  id: string;
  date: string;
  minutes: number | null;
  km: number | null;
  is_day_off: boolean;
  shifts: string[] | null;
  note: string | null;
  client_updated_at: string;
  updated_at: string;
  earnings: Array<{
    id: string;
    source: string;
    label: string | null;
    amount_cents: number;
    minutes: number | null;
  }>;
  expenses: Array<{
    id: string;
    category: string;
    label: string | null;
    amount_cents: number;
    liters: number | string | null;
    odometer_km: number | null;
    full_tank: boolean | null;
  }>;
};

export function fromRemote(row: RemoteDayRow, userId: string): LocalDay {
  return {
    id: row.id,
    userId,
    date: row.date,
    minutes: row.minutes,
    km: row.km,
    isDayOff: row.is_day_off,
    shifts: (row.shifts as Shift[] | null) ?? null,
    note: row.note,
    // Normalize to the same ISO format the device writes, so comparisons work.
    clientUpdatedAt: new Date(row.client_updated_at).toISOString(),
    dirty: 0,
    earnings: row.earnings.map((e) => ({
      id: e.id,
      source: e.source as Source,
      label: e.label,
      amountCents: e.amount_cents,
      minutes: e.minutes,
    })),
    expenses: row.expenses.map((x) => ({
      id: x.id,
      category: x.category as ExpenseCategory,
      label: x.label,
      amountCents: x.amount_cents,
      liters: x.liters == null ? null : Number(x.liters),
      odometerKm: x.odometer_km,
      fullTank: x.full_tank,
    })),
  };
}
