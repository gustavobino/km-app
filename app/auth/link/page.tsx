import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { LinkLanding } from "./LinkLanding";

export const metadata: Metadata = { title: "Entrando…" };

/** Where the e-mail link lands: the session arrives in the URL fragment. */
export default function LinkPage() {
  return (
    <Suspense>
      <ClientOnly
        fallback={
          <main className="mx-auto flex min-h-dvh w-full max-w-column flex-col justify-center gap-4 px-5">
            <h1 className="font-display text-[26px] font-extrabold">
              Entrando…
            </h1>
          </main>
        }
      >
        <LinkLanding />
      </ClientOnly>
    </Suspense>
  );
}
