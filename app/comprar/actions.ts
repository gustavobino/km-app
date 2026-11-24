"use server";

import { redirect } from "next/navigation";
import { can } from "@/lib/entitlements";
import { getAccessUser } from "@/lib/entitlements-server";
import { PRODUCT_TITLE, priceCents } from "@/lib/payments/config";
import { paymentProvider, siteUrl } from "@/lib/payments/server";

export type CheckoutResult = { ok: false; error: string };

/** Creates the Mercado Pago checkout for the signed-in user and sends them there. */
export async function startCheckout(): Promise<CheckoutResult> {
  const user = await getAccessUser();
  if (!user) redirect("/entrar?next=%2Fcomprar");
  if (!can(user, "purchase")) redirect("/registrar");

  let url: string;
  try {
    const base = siteUrl();
    const checkout = await paymentProvider().createCheckout({
      userId: user.id,
      email: user.email,
      amountCents: priceCents(),
      title: PRODUCT_TITLE,
      successUrl: `${base}/comprar?status=sucesso`,
      pendingUrl: `${base}/comprar?status=pendente`,
      failureUrl: `${base}/comprar?status=falha`,
      // Mercado Pago only calls public HTTPS URLs.
      notificationUrl: base.startsWith("https://")
        ? `${base}/api/webhooks/mercadopago`
        : null,
    });
    url = checkout.url;
  } catch (error) {
    console.error(
      "startCheckout failed:",
      error instanceof Error ? error.message : error,
    );
    return {
      ok: false,
      error: "O pagamento está indisponível agora. Tente de novo em instantes.",
    };
  }
  redirect(url);
}
