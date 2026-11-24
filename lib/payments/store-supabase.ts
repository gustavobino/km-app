import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentStore } from "./process";

/** PaymentStore on Supabase (service role: payments/entitlements are server-written only). */
export function supabasePaymentStore(db: SupabaseClient): PaymentStore {
  return {
    async upsertPayment(p) {
      const { data, error } = await db
        .from("payments")
        .upsert(
          {
            provider: p.provider,
            provider_payment_id: p.providerPaymentId,
            user_id: p.userId,
            status: p.status,
            amount_cents: p.amountCents,
            paid_at: p.paidAt,
            raw: p.raw ?? {},
          },
          { onConflict: "provider,provider_payment_id" },
        )
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },

    async grantPremium(userId, paymentRowId) {
      const { error } = await db
        .from("entitlements")
        .insert({
          user_id: userId,
          plan: "premium",
          source: "purchase",
          payment_id: paymentRowId,
        });
      if (!error) return "granted";
      if (error.code === "23505") return "already"; // one active premium per user
      throw error;
    },

    async revokeForPayment(paymentRowId, reason) {
      const { data, error } = await db
        .from("entitlements")
        .update({ revoked_at: new Date().toISOString(), revoke_reason: reason })
        .eq("payment_id", paymentRowId)
        .is("revoked_at", null)
        .select("id");
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  };
}
