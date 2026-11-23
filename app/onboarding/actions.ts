"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH, HOME_PATH } from "@/lib/auth/redirect";
import { toPayload } from "@/lib/onboarding";
import { onboardingAnswersSchema } from "@/lib/schemas/onboarding";
import { createClient } from "@/lib/supabase/server";

export type SaveOnboardingResult = { ok: false; error: string };

/**
 * Saves the onboarding answers (validated again here) and marks onboarding as
 * done. All writes go through the user's session, so RLS applies.
 */
export async function saveOnboarding(
  input: unknown,
): Promise<SaveOnboardingResult> {
  const parsed = onboardingAnswersSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Alguma resposta veio num formato inesperado. Tente de novo.",
    };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect(LOGIN_PATH);

  const payload = toPayload(parsed.data);

  if (payload.vehicle) {
    const { error } = await supabase
      .from("vehicles")
      .upsert(
        { user_id: userId, ...payload.vehicle },
        { onConflict: "user_id" },
      );
    if (error) return failed(error);
  }

  if (payload.platforms.length > 0) {
    // Re-running onboarding replaces the default ("net_already") app list.
    const { error: delError } = await supabase
      .from("platform_settings")
      .delete()
      .eq("user_id", userId)
      .eq("mode", "net_already");
    if (delError) return failed(delError);
    const { error } = await supabase.from("platform_settings").insert(
      payload.platforms.map((p) => ({
        user_id: userId,
        source: p.source,
        label: p.label,
        mode: "net_already",
      })),
    );
    if (error) return failed(error);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      ...payload.profile,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) return failed(error);

  redirect(HOME_PATH);
}

function failed(error: { message: string }): SaveOnboardingResult {
  console.error("saveOnboarding failed:", error.message);
  return {
    ok: false,
    error: "Não deu para salvar agora. Confira a internet e tente de novo.",
  };
}
