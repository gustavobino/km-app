import { redirect } from "next/navigation";
import { SyncProvider } from "@/components/day/SyncProvider";
import { TabBar } from "@/components/layout/TabBar";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { loadAppContext } from "@/lib/profile/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Same cached read the pages use: one round trip per screen.
  const ctx = await loadAppContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.onboardingCompleted) redirect("/onboarding");
  const userId = ctx.userId;

  return (
    <SyncProvider userId={userId}>
      {children}
      <TabBar />
      <ServiceWorkerRegister precacheApp />
    </SyncProvider>
  );
}
