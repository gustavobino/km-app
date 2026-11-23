"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { localDb } from "@/lib/local/db";
import { countDirty } from "@/lib/local/days";
import { singleFlight, syncNow } from "@/lib/sync/engine";
import { browserRemote } from "@/lib/sync/remote";

export type SyncState = {
  online: boolean;
  syncing: boolean;
  /** Days saved on this device that the server has not confirmed yet. */
  pending: number;
  /** Last sync failed for a reason other than being offline. */
  failed: boolean;
  sync: () => Promise<void>;
};

const runners = new Map<string, () => Promise<unknown>>();

function runnerFor(userId: string) {
  let run = runners.get(userId);
  if (!run) {
    run = singleFlight(() => syncNow(localDb(), userId, browserRemote));
    runners.set(userId, run);
  }
  return run;
}

/** Syncs on mount, when the connection comes back and when the app returns to the foreground. */
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

export function useSync(userId: string): SyncState {
  const online = useOnline();
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useLiveQuery(
    () => countDirty(localDb(), userId),
    [userId],
    0,
  );

  const sync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncing(true);
    try {
      await runnerFor(userId)();
      setFailed(false);
    } catch {
      setFailed(typeof navigator !== "undefined" ? navigator.onLine : true);
    } finally {
      setSyncing(false);
    }
  }, [userId]);

  useEffect(() => {
    const onOnline = () => void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const first = setTimeout(onOnline, 0);
    return () => {
      clearTimeout(first);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sync]);

  return { online, syncing, pending, failed, sync };
}
