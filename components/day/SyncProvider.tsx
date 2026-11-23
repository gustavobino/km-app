"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSync, type SyncState } from "./useSync";

const SyncContext = createContext<SyncState | null>(null);

/** Keeps the device and the server in sync while any tab of the app is open. */
export function SyncProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const state = useSync(userId);
  return <SyncContext.Provider value={state}>{children}</SyncContext.Provider>;
}

export function useSyncState(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncState must be used inside <SyncProvider>");
  return ctx;
}
