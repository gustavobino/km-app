import "server-only";
import type { PlatformSetting } from "@/lib/metrics/types";
import { createClient } from "@/lib/supabase/server";

export type AppContext = {
  userId: string;
  apps: string[];
  monthlyGoalCents: number | null;
  platformSettings: PlatformSetting[];
};

/** What the screens need about the driver. Null when signed out. */
export async function loadAppContext(): Promise<AppContext | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("apps,monthly_goal_cents")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("platform_settings")
      .select("source,label,mode,percent,pass_cents,pass_period"),
  ]);

  return {
    userId,
    apps: (profile?.apps as string[] | null) ?? [],
    monthlyGoalCents: (profile?.monthly_goal_cents as number | null) ?? null,
    platformSettings: (settings ?? []).map((s) => ({
      source: s.source,
      label: s.label,
      mode: s.mode,
      percent: s.percent == null ? null : Number(s.percent),
      passCents: s.pass_cents,
      passPeriod: s.pass_period,
    })),
  };
}
