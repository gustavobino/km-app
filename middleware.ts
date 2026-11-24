import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HOME_PATH, LOGIN_PATH, isProtectedPath } from "@/lib/auth/redirect";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Uses the (deprecated in Next 16) `middleware.ts` convention on purpose: it
 * runs on the Edge runtime, which OpenNext supports on Cloudflare Workers; the
 * Node.js `proxy.ts` is experimental there and crashed on signed-in requests.
 *
 * Refreshes the Supabase session cookie on every request and does the
 * optimistic auth redirects. Real authorization is RLS in the database.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not put code between createServerClient and getClaims (session refresh).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const target = request.nextUrl.clone();
    const [p, q] = path.split("?");
    target.pathname = p!;
    target.search = q ? `?${q}` : "";
    const redirect = NextResponse.redirect(target);
    // Keep refreshed session cookies on the redirect.
    for (const cookie of response.cookies.getAll())
      redirect.cookies.set(cookie);
    return redirect;
  };

  if (!signedIn && isProtectedPath(pathname)) {
    return redirectTo(
      `${LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}`,
    );
  }
  if (signedIn && pathname === LOGIN_PATH) {
    return redirectTo(HOME_PATH);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static files, the service worker, manifest and icons.
    "/((?!_next/static|_next/image|sw\\.js|manifest\\.webmanifest|icons/|favicon|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2?)$).*)",
  ],
};
