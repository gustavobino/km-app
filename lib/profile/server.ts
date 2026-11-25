import "server-only";
import { cache } from "react";
import type { PlatformSetting } from "@/lib/metrics/types";
import { createClient } from "@/lib/supabase/server";

export type AppContext = {
  userId: string;
  apps: string[];
  monthlyGoalCents: number | null;
  typicalHoursPerDay: number | null;
  typicalDaysPerMonth: number | null;
  platformSettings: PlatformSetting[];
  reminderEnabled: boolean;
  /** "20:30" (São Paulo). */
  reminderTime: string | null;
  onboardingCompleted: boolean;
};

/** What the screens need about the driver. Null when signed out. */
export const loadAppContext = cache(
  async function loadAppContext(): Promise<AppContext | null> {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (!userId) return null;

    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "apps,monthly_goal_cents,typical_hours_per_day,typical_days_per_month,reminder_enabled,reminder_time,onboarding_completed_at",
        )
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
      typicalHoursPerDay:
        profile?.typical_hours_per_day == null
          ? null
          : Number(profile.typical_hours_per_day),
      typicalDaysPerMonth:
        (profile?.typical_days_per_month as number | null) ?? null,
      onboardingCompleted: Boolean(profile?.onboarding_completed_at),
      reminderEnabled: Boolean(profile?.reminder_enabled),
      reminderTime:
        typeof profile?.reminder_time === "string"
          ? profile.reminder_time.slice(0, 5)
          : null,
      platformSettings: (settings ?? []).map((s) => ({
        source: s.source,
        label: s.label,
        mode: s.mode,
        percent: s.percent == null ? null : Number(s.percent),
        passCents: s.pass_cents,
        passPeriod: s.pass_period,
      })),
    };
  },
);
