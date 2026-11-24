import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Mercado Pago webhook signature (x-signature: "ts=…,v1=…").
 * Manifest: "id:{data.id};request-id:{x-request-id};ts:{ts};" signed with
 * HMAC-SHA256 and the webhook secret. Parts that are missing are left out of
 * the manifest, as in Mercado Pago's docs. data.id is lowercased when alphanumeric.
 */
export function mercadoPagoManifest(
  dataId: string | null,
  requestId: string | null,
  ts: string,
): string {
  let m = "";
  if (dataId)
    m += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) m += `request-id:${requestId};`;
  m += `ts:${ts};`;
  return m;
}

export function parseSignatureHeader(
  header: string | null,
): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  return parts.ts && parts.v1 ? { ts: parts.ts, v1: parts.v1 } : null;
}

export function signMercadoPago(secret: string, manifest: string): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

/** Constant-time check of a webhook request. `maxAgeMs` rejects replays of old requests. */
export function verifyMercadoPagoSignature(input: {
  secret: string;
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  now?: number;
  maxAgeMs?: number;
}): boolean {
  const sig = parseSignatureHeader(input.signatureHeader);
  if (!sig || !input.secret) return false;
  if (input.maxAgeMs != null) {
    const tsMs = Number(sig.ts) < 1e12 ? Number(sig.ts) * 1000 : Number(sig.ts);
    if (
      !Number.isFinite(tsMs) ||
      Math.abs((input.now ?? Date.now()) - tsMs) > input.maxAgeMs
    )
      return false;
  }
  const expected = signMercadoPago(
    input.secret,
    mercadoPagoManifest(input.dataId, input.requestId, sig.ts),
  );
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig.v1, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
