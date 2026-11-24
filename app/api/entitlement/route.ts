import { NextResponse } from "next/server";
import { can } from "@/lib/entitlements";
import { getAccessUser } from "@/lib/entitlements-server";

/** Polled by the purchase screen while a payment is being confirmed. */
export async function GET() {
  const user = await getAccessUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json(
    { app: can(user, "app") },
    { headers: { "Cache-Control": "no-store" } },
  );
}
