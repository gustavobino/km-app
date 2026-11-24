/** Price and product name come from configuration, not code (CLAUDE.md). */

export const PRODUCT_TITLE = "Km+ · acesso completo";

export function priceCents(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.PRICE_BRL_CENTS;
  const n = raw ? Number(raw) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error(
      "PRICE_BRL_CENTS must be a positive integer (e.g. 1790 for R$ 17,90).",
    );
  }
  return n;
}

/** Refund window (CDC, direito de arrependimento). */
export const REFUND_DAYS = 7;
