"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LinkButton } from "@/components/ui/Button";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

/**
 * Finishes the e-mail link login. The Supabase client reads the tokens from
 * the URL fragment (#access_token=…), stores the session in cookies and we
 * move on. Errors come in the fragment too (#error_code=otp_expired).
 */
export function LinkLanding() {
  const router = useRouter();
  const params = useSearchParams();
  // Rendered only in the browser (see page.tsx), so reading the fragment here is safe.
  const [failed, setFailed] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return Boolean(hash.get("error") || hash.get("error_code"));
  });

  useEffect(() => {
    if (failed) return;
    const next = safeNextPath(params.get("next"));
    const supabase = createClient();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // Drop the tokens from the address bar before moving on.
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(next);
      router.refresh();
    };
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      void supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => (error ? setFailed(true) : finish()));
    } else {
      // Older links (?code=…) are exchanged by the client itself; or already signed in.
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) finish();
      });
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") finish();
    });
    const timeout = setTimeout(() => {
      if (!done) setFailed(true);
    }, 8000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [failed, params, router]);

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-column flex-col justify-center gap-4 px-5"
      aria-live="polite"
    >
      <div className="font-display text-[28px] font-extrabold tracking-hero">
        Km+
      </div>
      {failed ? (
        <>
          <h1 className="font-display text-[26px] leading-tight font-extrabold">
            Esse link expirou ou já foi usado
          </h1>
          <p className="text-[15px] font-semibold text-muted">
            Peça um novo link. Ele vale por 1 hora e só funciona uma vez.
          </p>
          <LinkButton href="/entrar" block>
            Pedir um novo link
          </LinkButton>
        </>
      ) : (
        <h1 className="font-display text-[26px] leading-tight font-extrabold">
          Entrando…
        </h1>
      )}
    </main>
  );
}
