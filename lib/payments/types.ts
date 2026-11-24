/** Payment provider abstraction, so Mercado Pago can be swapped later. */

export type PaymentStatus =
  | "approved"
  | "pending"
  | "in_process"
  | "authorized"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export type ProviderPayment = {
  id: string;
  status: PaymentStatus | string;
  amountCents: number;
  currency: string;
  /** Our user id, sent when creating the checkout. */
  externalReference: string | null;
  paidAt: string | null;
  raw: unknown;
};

export type CheckoutRequest = {
  userId: string;
  email: string | null;
  amountCents: number;
  title: string;
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
  notificationUrl: string | null;
};

export interface PaymentProvider {
  readonly name: "mercadopago";
  /** Creates a hosted checkout and returns where to send the buyer. */
  createCheckout(
    req: CheckoutRequest,
  ): Promise<{ url: string; reference: string }>;
  /** Reads the payment from the provider API (never trust the browser). */
  getPayment(id: string): Promise<ProviderPayment | null>;
}
