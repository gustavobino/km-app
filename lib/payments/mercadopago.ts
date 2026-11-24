import type {
  CheckoutRequest,
  PaymentProvider,
  ProviderPayment,
} from "./types";

const API = "https://api.mercadopago.com";

type Fetch = typeof fetch;

/** Mercado Pago Checkout Pro (Pix + card), via its REST API. */
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago" as const;

  constructor(
    private readonly accessToken: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  private headers(extra: Record<string, string> = {}) {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  async createCheckout(req: CheckoutRequest) {
    const body = {
      items: [
        {
          id: "kmplus-premium",
          title: req.title,
          quantity: 1,
          currency_id: "BRL",
          unit_price: req.amountCents / 100,
        },
      ],
      external_reference: req.userId,
      metadata: { user_id: req.userId },
      payer: req.email ? { email: req.email } : undefined,
      back_urls: {
        success: req.successUrl,
        pending: req.pendingUrl,
        failure: req.failureUrl,
      },
      // Mercado Pago only accepts auto_return with public HTTPS return URLs.
      auto_return: req.successUrl.startsWith("https://") ? "approved" : undefined,
      notification_url: req.notificationUrl ?? undefined,
      statement_descriptor: "KMPLUS",
      payment_methods: { installments: 1 },
    };
    const res = await this.fetchImpl(`${API}/checkout/preferences`, {
      method: "POST",
      headers: this.headers({
        "X-Idempotency-Key": `${req.userId}-${Date.now()}`,
      }),
      body: JSON.stringify(body),
    });
    if (!res.ok)
      throw new Error(`Mercado Pago preference failed: HTTP ${res.status}`);
    const json = (await res.json()) as {
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
    };
    const url = json.init_point ?? json.sandbox_init_point;
    if (!url) throw new Error("Mercado Pago preference without init_point");
    return { url, reference: json.id };
  }

  async getPayment(id: string): Promise<ProviderPayment | null> {
    if (!/^\d+$/.test(id)) return null;
    const res = await this.fetchImpl(`${API}/v1/payments/${id}`, {
      headers: this.headers(),
    });
    if (res.status === 404) return null;
    if (!res.ok)
      throw new Error(`Mercado Pago payment lookup failed: HTTP ${res.status}`);
    const p = (await res.json()) as {
      id: number;
      status: string;
      transaction_amount: number;
      currency_id: string;
      external_reference: string | null;
      date_approved: string | null;
    };
    return {
      id: String(p.id),
      status: p.status,
      amountCents: Math.round(p.transaction_amount * 100),
      currency: p.currency_id,
      externalReference: p.external_reference,
      paidAt: p.date_approved,
      raw: p,
    };
  }
}
