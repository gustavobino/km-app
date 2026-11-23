import type { Metadata } from "next";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Insights" };

export default function Page() {
  return (
    <Screen>
      <ScreenHeader title="Insights" />
      <EmptyState
        title="Em construção"
        description="Os insights chegam no marco M6."
      />
    </Screen>
  );
}
