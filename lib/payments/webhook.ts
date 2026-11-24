/**
 * Mercado Pago webhook handling, independent of Next.js so it can be tested.
 * 1) verify the signature, 2) only "payment" events, 3) re-read the payment
 * from the provider API and update payments/entitlements (idempotent).
 */
import type { ProcessOutcome } from "./process";
import { verifyMercadoPagoSignature } from "./signature";

export type WebhookResult = { status: number; body: Record<string, unknown> };

export async function handleMercadoPagoWebhook(
  req: { url: string; headers: Headers; body: unknown },
  deps: {
    secret: string | undefined;
    process: (paymentId: string) => Promise<ProcessOutcome>;
  },
): Promise<WebhookResult> {
  const url = new URL(req.url);
  const body = (req.body ?? {}) as {
    type?: string;
    action?: string;
    data?: { id?: string | number };
  };
  const dataId =
    url.searchParams.get("data.id") ??
    (body.data?.id != null ? String(body.data.id) : null);
  const type =
    url.searchParams.get("type") ??
    url.searchParams.get("topic") ??
    body.type ??
    null;

  if (!deps.secret)
    return { status: 500, body: { error: "webhook secret not configured" } };
  const valid = verifyMercadoPagoSignature({
    secret: deps.secret,
    signatureHeader: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    dataId: url.searchParams.get("data.id") ?? dataId,
  });
  if (!valid) return { status: 401, body: { error: "invalid signature" } };

  if (type !== "payment" || !dataId)
    return { status: 200, body: { ignored: true } };

  try {
    const outcome = await deps.process(dataId);
    return { status: 200, body: { outcome } };
  } catch (error) {
    console.error(
      "mercadopago webhook failed:",
      error instanceof Error ? error.message : error,
    );
    // 5xx makes Mercado Pago retry later.
    return { status: 500, body: { error: "processing failed" } };
  }
}
