"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/app/sair/actions";

/** Clears this device's cached pages (they hold the user's data) and signs out. */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      block
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(
              keys
                .filter((k) => k.startsWith("kmplus-pages-"))
                .map((k) => caches.delete(k)),
            );
          }
          await signOut();
        })
      }
    >
      {pending ? "Saindo…" : "Sair da conta"}
    </Button>
  );
}
