"use client";

import type { ComponentProps } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { Skeleton } from "@/components/ui/States";
import { Simulator } from "./Simulator";

export function SimulatorClient(props: ComponentProps<typeof Simulator>) {
  return (
    <ClientOnly
      fallback={
        <main
          aria-busy="true"
          className="mx-auto flex w-full max-w-column flex-col gap-gap-card px-5 pt-6"
        >
          <h1 className="font-display text-[30px] leading-[1.1] font-extrabold">
            Simulador de meta
          </h1>
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-28" />
          <Skeleton className="h-24" />
          <Skeleton className="h-36 rounded-hero" />
        </main>
      }
    >
      <Simulator {...props} />
    </ClientOnly>
  );
}
