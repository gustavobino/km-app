"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/States";

/** The register screen reads IndexedDB and the device date, so it renders only in the browser. */
export const RegisterDayClient = dynamic(
  () => import("./RegisterDay").then((m) => m.RegisterDay),
  {
    ssr: false,
    loading: () => (
      <main
        aria-busy="true"
        className="mx-auto flex w-full max-w-column flex-col gap-gap-card px-5 pt-6"
      >
        <span className="sr-only">Carregando…</span>
        <Skeleton className="h-16" />
        <Skeleton className="h-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
      </main>
    ),
  },
);
