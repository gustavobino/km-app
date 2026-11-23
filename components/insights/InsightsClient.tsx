"use client";

import type { ComponentProps } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { Skeleton } from "@/components/ui/States";
import { Insights } from "./Insights";

export function InsightsClient(props: ComponentProps<typeof Insights>) {
  return (
    <ClientOnly
      fallback={
        <main
          aria-busy="true"
          className="mx-auto flex w-full max-w-column flex-col gap-gap-card px-5 pt-6"
        >
          <h1 className="font-display text-[30px] leading-[1.1] font-extrabold">
            Insights
          </h1>
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-32 rounded-hero" />
          <Skeleton className="h-19" />
        </main>
      }
    >
      <Insights {...props} />
    </ClientOnly>
  );
}
