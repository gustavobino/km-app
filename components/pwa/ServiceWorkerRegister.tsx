"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds only (dev reloads would fight the cache). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline support is a progressive enhancement; the app still works online.
    });
  }, []);
  return null;
}
