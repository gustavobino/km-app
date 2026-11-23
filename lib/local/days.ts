/**
 * Day storage on the device. Every write marks the day dirty; the sync engine
 * sends dirty days and clears the flag when the server confirms.
 */
import type { DateRange, LocalDate } from "../dates";
import type { StoredDay } from "../day/form";
import type { KmDatabase, LocalDay } from "./db";

export async function getLocalDay(
  db: KmDatabase,
  userId: string,
  date: LocalDate,
) {
  return db.days.where("[userId+date]").equals([userId, date]).first();
}

export async function listLocalDays(
  db: KmDatabase,
  userId: string,
  range: DateRange,
) {
  return db.days
    .where("[userId+date]")
    .between([userId, range.start], [userId, range.end], true, true)
    .toArray();
}

export async function countDirty(db: KmDatabase, userId: string) {
  return db.days.where("[userId+dirty]").equals([userId, 1]).count();
}

export async function listDirty(db: KmDatabase, userId: string) {
  return db.days.where("[userId+dirty]").equals([userId, 1]).toArray();
}

/** Saves the driver's edit. Re-saving the same date edits that day (same id). */
export async function saveLocalDay(
  db: KmDatabase,
  userId: string,
  day: Omit<StoredDay, "id">,
  opts: { newId: () => string; now: Date },
): Promise<LocalDay> {
  return db.transaction("rw", db.days, async () => {
    const existing = await getLocalDay(db, userId, day.date);
    const record: LocalDay = {
      ...day,
      id: existing?.id ?? opts.newId(),
      userId,
      clientUpdatedAt: opts.now.toISOString(),
      dirty: 1,
    };
    await db.days.put(record);
    return record;
  });
}

/**
 * Server accepted (or already had a newer version of) a pushed day.
 * Clears `dirty` only if the day was not edited again meanwhile, and adopts the
 * server id when the server merged it into an existing day of the same date.
 */
export async function markSynced(
  db: KmDatabase,
  localId: string,
  sentClientUpdatedAt: string,
  serverId: string,
): Promise<void> {
  await db.transaction("rw", db.days, async () => {
    const row = await db.days.get(localId);
    if (!row) return;
    const editedSince = row.clientUpdatedAt !== sentClientUpdatedAt;
    const next: LocalDay = { ...row, id: serverId, dirty: editedSince ? 1 : 0 };
    if (serverId !== localId) await db.days.delete(localId);
    await db.days.put(next);
  });
}

/**
 * Applies days that came from the server. Local unsent edits always win here:
 * they are pushed next, and the server keeps whichever edit is newer.
 */
export async function mergeRemoteDays(
  db: KmDatabase,
  userId: string,
  remote: readonly LocalDay[],
) {
  let applied = 0;
  await db.transaction("rw", db.days, async () => {
    for (const r of remote) {
      const local = await getLocalDay(db, userId, r.date);
      if (local?.dirty) continue;
      if (
        local &&
        local.id === r.id &&
        local.clientUpdatedAt >= r.clientUpdatedAt
      )
        continue;
      if (local && local.id !== r.id) await db.days.delete(local.id);
      await db.days.put({ ...r, userId, dirty: 0 });
      applied += 1;
    }
  });
  return applied;
}

export async function getMeta<T>(
  db: KmDatabase,
  key: string,
): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(db: KmDatabase, key: string, value: unknown) {
  await db.meta.put({ key, value });
}
