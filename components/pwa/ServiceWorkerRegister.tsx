"use client";

import { useEffect } from "react";

const PRECACHE_FLAG = "kmplus-precached";

/**
 * Registers /sw.js in production builds only (dev reloads would fight the
 * cache). With `precacheApp` (used inside the signed-in app), asks the worker
 * once per session to cache every tab so they open offline.
 */
export function ServiceWorkerRegister({
  precacheApp = false,
}: {
  precacheApp?: boolean;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async () => {
        if (!precacheApp) return;
        try {
          if (sessionStorage.getItem(PRECACHE_FLAG)) return;
          sessionStorage.setItem(PRECACHE_FLAG, "1");
        } catch {
          // Storage blocked: precaching on every load is still correct.
        }
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: "PRECACHE_APP" });
      })
      .catch(() => {
        // Offline support is a progressive enhancement; the app still works online.
      });
  }, [precacheApp]);
  return null;
}
