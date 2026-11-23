import type { Metadata } from "next";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Como foi o dia?" };

export default function Page() {
  return (
    <Screen>
      <ScreenHeader title="Como foi o dia?" />
      <EmptyState
        title="Em construção"
        description="O registro do dia chega no marco M2."
      />
    </Screen>
  );
}
