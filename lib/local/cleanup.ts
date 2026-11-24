"use client";

import { wipeLocalData } from "./db";

/** Erases this device's copy of the driver's data: cached pages and IndexedDB. */
export async function cleanDevice(): Promise<void> {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("kmplus-pages-"))
        .map((k) => caches.delete(k)),
    );
  }
  await wipeLocalData().catch(() => undefined);
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
}
