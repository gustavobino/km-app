import type { Metadata } from "next";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Simulador de meta" };

export default function Page() {
  return (
    <Screen>
      <ScreenHeader title="Simulador de meta" />
      <EmptyState
        title="Em construção"
        description="O simulador chega no marco M5."
      />
    </Screen>
  );
}
