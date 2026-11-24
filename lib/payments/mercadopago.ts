import type {
  CheckoutRequest,
  PaymentProvider,
  ProviderPayment,
} from "./types";

export const MP_API = "https://api.mercadopago.com";

type Fetch = typeof fetch;

export type MercadoPagoOptions = {
  fetchImpl?: Fetch;
  /**
   * Base URL of the Mercado Pago API. On Cloudflare it points to our relay
   * (supabase/functions/mp-relay), since Mercado Pago blocks Workers traffic.
   */
  apiBase?: string;
  /** Sent as `x-relay-key` when going through the relay. */
  relayKey?: string;
};

/** Mercado Pago Checkout Pro (Pix + card), via its REST API. */
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago" as const;

  private readonly fetchImpl: Fetch;
  private readonly api: string;
  private readonly relayKey: string | undefined;

  constructor(
    private readonly accessToken: string,
    opts: MercadoPagoOptions | Fetch = {},
  ) {
    const o = typeof opts === "function" ? { fetchImpl: opts } : opts;
    this.fetchImpl = o.fetchImpl ?? ((...a) => fetch(...a));
    this.api = (o.apiBase || MP_API).replace(/\/$/, "");
    this.relayKey = o.relayKey;
  }

  private headers(extra: Record<string, string> = {}) {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      // Cloudflare Workers send no User-Agent by default, and Mercado Pago's
      // firewall answers anonymous requests with an empty HTTP 403.
      "User-Agent": "KmPlus/1.0 (+https://kmmais.app.br)",
      ...(this.relayKey ? { "x-relay-key": this.relayKey } : {}),
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
      // No payer e-mail: Mercado Pago asks for it at checkout. Sending a real
      // e-mail makes test checkouts fail ("uma das partes é de teste").
      back_urls: {
        success: req.successUrl,
        pending: req.pendingUrl,
        failure: req.failureUrl,
      },
      // Mercado Pago only accepts auto_return with public HTTPS return URLs.
      auto_return: req.successUrl.startsWith("https://")
        ? "approved"
        : undefined,
      notification_url: req.notificationUrl ?? undefined,
      statement_descriptor: "KMPLUS",
      payment_methods: { installments: 1 },
    };
    const res = await this.fetchImpl(`${this.api}/checkout/preferences`, {
      method: "POST",
      headers: this.headers({
        "X-Idempotency-Key": `${req.userId}-${Date.now()}`,
      }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Mercado Pago preference failed: HTTP ${res.status} ${detail.slice(0, 200)}`.trim(),
      );
    }
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
    const res = await this.fetchImpl(`${this.api}/v1/payments/${id}`, {
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
