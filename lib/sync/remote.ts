"use client";

import { createClient } from "../supabase/client";
import type { DayPayload, SyncResult } from "../schemas/day";
import type { RemoteApi } from "./engine";
import type { RemoteDayRow } from "./payload";

export class SyncHttpError extends Error {
  constructor(public status: number) {
    super(`sync failed with HTTP ${status}`);
  }
}

const DAY_COLUMNS =
  "id,date,minutes,km,is_day_off,shifts,note,client_updated_at,updated_at," +
  "earnings(id,source,label,amount_cents,minutes)," +
  "expenses(id,category,label,amount_cents,liters,odometer_km,full_tank)";

/** Browser transport: push through our API (zod-validated), pull straight from Supabase (RLS). */
export const browserRemote: RemoteApi = {
  async push(days: DayPayload[]): Promise<SyncResult[]> {
    const res = await fetch("/api/sync/days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
      credentials: "same-origin",
    });
    if (!res.ok) throw new SyncHttpError(res.status);
    return ((await res.json()) as { results: SyncResult[] }).results;
  },

  async pull(since: string | null, limit: number): Promise<RemoteDayRow[]> {
    let query = createClient()
      .from("days")
      .select(DAY_COLUMNS)
      .order("updated_at", { ascending: true })
      .limit(limit);
    if (since) query = query.gt("updated_at", since);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as RemoteDayRow[];
  },
};
