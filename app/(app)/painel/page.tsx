import type { Metadata } from "next";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Painel" };

export default function Page() {
  return (
    <Screen>
      <ScreenHeader title="Painel" />
      <EmptyState
        title="Registre seu primeiro dia para ver o painel"
        description="As métricas chegam no marco M3."
      />
    </Screen>
  );
}
