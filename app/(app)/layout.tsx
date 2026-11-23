import { redirect } from "next/navigation";
import { TabBar } from "@/components/layout/TabBar";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(LOGIN_PATH);

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  return (
    <>
      {children}
      <TabBar />
      <ServiceWorkerRegister precacheApp />
    </>
  );
}
