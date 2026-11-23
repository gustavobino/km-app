import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: readonly EmailOtpType[] = ["email", "magiclink", "signup"];

/**
 * Magic link with a custom e-mail template ({{ .TokenHash }}): verifies the
 * token hash server-side. Works in any browser, including when the link opens
 * outside the installed PWA. See db/auth-templates/login.html.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL(`${LOGIN_PATH}?erro=link`, origin));
}
