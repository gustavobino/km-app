"use client";

import type { ComponentProps } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { Skeleton } from "@/components/ui/States";
import { YearView } from "./YearView";

export function YearClient(props: ComponentProps<typeof YearView>) {
  return (
    <ClientOnly
      fallback={
        <main
          aria-busy="true"
          className="mx-auto flex w-full max-w-column flex-col gap-gap-card px-5 pt-5"
        >
          <h1 className="pl-9 font-display text-[26px] leading-[1.1] font-extrabold">
            Resumo do ano
          </h1>
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-48 rounded-hero" />
          <Skeleton className="h-40" />
        </main>
      }
    >
      <YearView {...props} />
    </ClientOnly>
  );
}
