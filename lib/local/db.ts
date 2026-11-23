import Dexie, { type Table } from "dexie";
import type { StoredDay } from "../day/form";

/**
 * A day as stored on the device. `dirty` = 1 while it still has to be sent
 * to the server (Dexie cannot index booleans, hence 0/1).
 */
export type LocalDay = StoredDay & {
  userId: string;
  /** When the driver last edited it on a device (ISO). Decides "last edit wins". */
  clientUpdatedAt: string;
  dirty: 0 | 1;
};

export type MetaRow = { key: string; value: unknown };

export class KmDatabase extends Dexie {
  days!: Table<LocalDay, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = "kmplus") {
    super(name);
    this.version(1).stores({
      days: "id, userId, [userId+date], [userId+dirty]",
      meta: "key",
    });
  }
}

let instance: KmDatabase | undefined;

/** The app's IndexedDB (browser only). */
export function localDb(): KmDatabase {
  if (!instance) instance = new KmDatabase();
  return instance;
}

/** Erases everything stored on this device (sign-out). */
export async function wipeLocalData(): Promise<void> {
  const db = localDb();
  db.close();
  await Dexie.delete(db.name);
  instance = undefined;
}
