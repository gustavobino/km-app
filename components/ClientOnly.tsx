"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noopSubscribe = () => () => {};

/** True after hydration in the browser, false on the server and during hydration (no mismatch). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Renders children only in the browser. Unlike next/dynamic with ssr:false,
 * the code ships with the page, so the service worker caches it for offline use.
 */
export function ClientOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  return useIsClient() ? children : fallback;
}
