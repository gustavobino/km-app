import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { priceCents } from "./config";
import { MercadoPagoProvider } from "./mercadopago";
import { processPayment } from "./process";
import { supabasePaymentStore } from "./store-supabase";
import type { PaymentProvider } from "./types";

export function paymentProvider(): PaymentProvider {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set");
  // On Cloudflare, Mercado Pago is reached through the Supabase relay
  // (MERCADOPAGO_API_BASE in wrangler.jsonc), authenticated with our secret key.
  const apiBase = process.env.MERCADOPAGO_API_BASE;
  return new MercadoPagoProvider(token, {
    apiBase,
    relayKey: apiBase ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined,
  });
}

export function processProviderPayment(paymentId: string) {
  return processPayment(paymentId, {
    provider: paymentProvider(),
    store: supabasePaymentStore(adminClient()),
    priceCents: priceCents(),
  });
}

/** Public base URL of the app (for checkout return and webhook URLs). */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
