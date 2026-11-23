/**
 * Offline-first sync: push dirty days, then pull what changed on the server.
 * The transport is injected (RemoteApi) so this runs in tests without network.
 */
import type { KmDatabase } from "../local/db";
import {
  getMeta,
  listDirty,
  markSynced,
  mergeRemoteDays,
  setMeta,
} from "../local/days";
import type { DayPayload, SyncResult } from "../schemas/day";
import { fromRemote, toPayload, type RemoteDayRow } from "./payload";

export const PUSH_BATCH = 20;
export const PULL_PAGE = 500;

export type RemoteApi = {
  push(days: DayPayload[]): Promise<SyncResult[]>;
  /** Days with updated_at > since (or all when null), oldest first, at most `limit`. */
  pull(since: string | null, limit: number): Promise<RemoteDayRow[]>;
};

export type SyncReport = { pushed: number; failed: number; pulled: number };

const cursorKey = (userId: string) => `pullCursor:${userId}`;

export async function syncNow(
  db: KmDatabase,
  userId: string,
  api: RemoteApi,
): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, failed: 0, pulled: 0 };

  const dirty = await listDirty(db, userId);
  for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
    const batch = dirty.slice(i, i + PUSH_BATCH);
    const results = await api.push(batch.map(toPayload));
    for (const day of batch) {
      const r = results.find((x) => x.localId === day.id);
      if (r?.ok) {
        await markSynced(db, day.id, day.clientUpdatedAt, r.id);
        report.pushed += 1;
      } else {
        report.failed += 1;
      }
    }
  }

  let since = (await getMeta<string>(db, cursorKey(userId))) ?? null;
  for (;;) {
    const rows = await api.pull(since, PULL_PAGE);
    if (rows.length === 0) break;
    report.pulled += await mergeRemoteDays(
      db,
      userId,
      rows.map((r) => fromRemote(r, userId)),
    );
    since = rows[rows.length - 1]!.updated_at;
    await setMeta(db, cursorKey(userId), since);
    if (rows.length < PULL_PAGE) break;
  }

  return report;
}

/**
 * Runs at most one sync at a time. A call made while a run is in progress
 * schedules exactly one more run afterwards (the new call may carry changes
 * the running one did not see, e.g. a day saved mid-sync), and resolves when
 * that follow-up finishes.
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | null = null;
  let queued: Promise<T> | null = null;

  const start = (): Promise<T> => {
    running = fn().finally(() => {
      running = null;
    });
    return running;
  };

  return () => {
    if (!running) return start();
    if (!queued) {
      queued = running
        .catch(() => undefined)
        .then(() => {
          queued = null;
          return start();
        });
    }
    return queued;
  };
}
