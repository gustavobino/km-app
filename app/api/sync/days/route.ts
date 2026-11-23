import { NextResponse, type NextRequest } from "next/server";
import { syncRequestSchema, type SyncResult } from "@/lib/schemas/day";
import { createClient } from "@/lib/supabase/server";

/**
 * Receives days saved offline and stores each one with save_day()
 * (atomic, idempotent, last edit wins). Runs with the user's session: RLS applies.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    );
  }

  const results: SyncResult[] = [];
  for (const day of parsed.data.days) {
    const { data, error } = await supabase.rpc("save_day", { payload: day });
    if (error) {
      console.error("save_day failed:", error.code, error.message);
      results.push({
        localId: day.id,
        ok: false,
        error: error.code ?? "db_error",
      });
      continue;
    }
    const r = data as {
      id: string;
      applied: boolean;
      client_updated_at: string;
    };
    results.push({
      localId: day.id,
      ok: true,
      id: r.id,
      applied: r.applied,
      client_updated_at: r.client_updated_at,
    });
  }
  return NextResponse.json({ results });
}
