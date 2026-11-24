import { NextResponse } from "next/server";
import { today } from "@/lib/dates";
import { buildExportFiles } from "@/lib/export/build";
import { zip } from "@/lib/export/zip";
import { createClient } from "@/lib/supabase/server";

/** "Exportar meus dados": everything the user has, read through RLS, as a ZIP of CSVs. */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [
    profile,
    vehicle,
    platforms,
    days,
    maintenance,
    payments,
    entitlements,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("vehicles").select("*").maybeSingle(),
    supabase.from("platform_settings").select("*"),
    supabase
      .from("days")
      .select("*, earnings(*), expenses(*)")
      .order("date")
      .limit(10000),
    supabase.from("maintenance_items").select("*"),
    supabase
      .from("payments")
      .select("provider_payment_id,status,amount_cents,paid_at"),
    supabase
      .from("entitlements")
      .select("plan,source,granted_at,revoked_at,revoke_reason"),
  ]);
  const failed = [
    profile,
    vehicle,
    platforms,
    days,
    maintenance,
    payments,
    entitlements,
  ].find((r) => r.error);
  if (failed)
    return NextResponse.json({ error: "export_failed" }, { status: 500 });

  const files = buildExportFiles({
    email: typeof claims.claims.email === "string" ? claims.claims.email : null,
    profile: profile.data,
    vehicle: vehicle.data,
    platforms: platforms.data ?? [],
    days: days.data ?? [],
    maintenance: maintenance.data ?? [],
    payments: payments.data ?? [],
    entitlements: entitlements.data ?? [],
  });
  const body = zip(files);
  return new NextResponse(body as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="km-mais-meus-dados-${today()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
