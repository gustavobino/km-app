"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/app/sair/actions";
import { cleanDevice } from "@/lib/local/cleanup";
import { localDb } from "@/lib/local/db";

/**
 * Signs out and erases this device's copy of the driver's data (cached pages
 * and IndexedDB). Warns first if some days were not sent to the server yet.
 */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      block
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const unsent = await localDb()
            .days.filter((d) => d.dirty === 1)
            .count()
            .catch(() => 0);
          if (
            unsent > 0 &&
            !window.confirm(
              `${unsent === 1 ? "1 dia ainda não foi enviado" : `${unsent} dias ainda não foram enviados`} para a nuvem. Se sair agora, ${unsent === 1 ? "ele será perdido" : "eles serão perdidos"}. Sair mesmo assim?`,
            )
          ) {
            return;
          }
          await cleanDevice();
          await signOut();
        })
      }
    >
      {pending ? "Saindo…" : "Sair da conta"}
    </Button>
  );
}
