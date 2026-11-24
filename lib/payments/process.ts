/**
 * Turns a payment notification into stored payments and entitlements.
 * Idempotent: the same notification can arrive many times.
 */
import type { PaymentProvider, ProviderPayment } from "./types";

export type PaymentStore = {
  /** Insert or update by (provider, provider payment id); returns our row id. */
  upsertPayment(p: {
    provider: string;
    providerPaymentId: string;
    userId: string | null;
    status: string;
    amountCents: number;
    paidAt: string | null;
    raw: unknown;
  }): Promise<string>;
  /** Grants premium unless the user already has an active premium entitlement. */
  grantPremium(
    userId: string,
    paymentRowId: string,
  ): Promise<"granted" | "already">;
  /** Revokes the entitlement created by this payment, if active. */
  revokeForPayment(paymentRowId: string, reason: string): Promise<boolean>;
};

export type ProcessOutcome =
  | "not_found"
  | "granted"
  | "already_granted"
  | "revoked"
  | "recorded"
  | "amount_mismatch"
  | "unknown_user";

const REVERSED = new Set(["refunded", "charged_back", "cancelled"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function processPayment(
  paymentId: string,
  deps: { provider: PaymentProvider; store: PaymentStore; priceCents: number },
): Promise<ProcessOutcome> {
  const payment: ProviderPayment | null =
    await deps.provider.getPayment(paymentId);
  if (!payment) return "not_found";

  const userId =
    payment.externalReference && UUID.test(payment.externalReference)
      ? payment.externalReference
      : null;
  const rowId = await deps.store.upsertPayment({
    provider: deps.provider.name,
    providerPaymentId: payment.id,
    userId,
    status: payment.status,
    amountCents: payment.amountCents,
    paidAt: payment.paidAt,
    raw: payment.raw,
  });

  if (payment.status === "approved") {
    if (!userId) return "unknown_user";
    if (payment.currency !== "BRL" || payment.amountCents < deps.priceCents)
      return "amount_mismatch";
    return (await deps.store.grantPremium(userId, rowId)) === "granted"
      ? "granted"
      : "already_granted";
  }
  if (REVERSED.has(payment.status)) {
    return (await deps.store.revokeForPayment(
      rowId,
      `payment ${payment.status}`,
    ))
      ? "revoked"
      : "recorded";
  }
  return "recorded";
}
