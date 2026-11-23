import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic link with the default Supabase e-mail (PKCE): Supabase redirects here
 * with ?code=…, which is exchanged for a session. Only works in the same
 * browser that asked for the link (the PKCE verifier lives in a cookie).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL(`${LOGIN_PATH}?erro=link`, origin));
}
