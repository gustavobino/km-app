"use client";

import type { ComponentProps } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { Skeleton } from "@/components/ui/States";
import { Dashboard } from "./Dashboard";

/** The Painel reads IndexedDB and the device date, so it renders only in the browser. */
export function DashboardClient(props: ComponentProps<typeof Dashboard>) {
  return (
    <ClientOnly
      fallback={
        <main
          aria-busy="true"
          className="mx-auto flex w-full max-w-column flex-col gap-gap-card px-5 pt-6"
        >
          <h1 className="font-display text-[30px] leading-[1.1] font-extrabold">
            Painel
          </h1>
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-13" />
          <Skeleton className="h-64 rounded-hero" />
          <Skeleton className="h-24" />
        </main>
      }
    >
      <Dashboard {...props} />
    </ClientOnly>
  );
}
