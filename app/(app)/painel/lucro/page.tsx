import type { Metadata } from "next";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Lucro líquido" };

export default function Page() {
  return (
    <Screen>
      <ScreenHeader title="Lucro líquido" />
      <EmptyState
        title="Em construção"
        description="O lucro líquido chega no marco M4."
      />
    </Screen>
  );
}
