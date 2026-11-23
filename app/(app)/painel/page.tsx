import type { Metadata } from "next";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import Link from "next/link";
import { EmptyState } from "@/components/ui/States";
import { GearIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Painel" };

export default function Page() {
  return (
    <Screen>
      <ScreenHeader
        title="Painel"
        trailing={
          <Link
            href="/ajustes"
            aria-label="Ajustes"
            className="-mr-2.5 flex size-touch items-center justify-center"
          >
            <GearIcon />
          </Link>
        }
      />
      <EmptyState
        title="Registre seu primeiro dia para ver o painel"
        description="As métricas chegam no marco M3."
      />
    </Screen>
  );
}
