import { NextResponse, type NextRequest } from "next/server";
import { processProviderPayment } from "@/lib/payments/server";
import { handleMercadoPagoWebhook } from "@/lib/payments/webhook";

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Some notifications carry everything in the query string.
  }
  const result = await handleMercadoPagoWebhook(
    { url: request.url, headers: request.headers, body },
    {
      secret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
      process: processProviderPayment,
    },
  );
  return NextResponse.json(result.body, { status: result.status });
}
