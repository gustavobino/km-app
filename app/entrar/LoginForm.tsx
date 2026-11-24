"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { CapsLabel, Card, HeroCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { emailSchema, otpCodeSchema } from "@/lib/schemas/auth";
import { authErrorMessage } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/client";
import { otpClient } from "@/lib/supabase/otp-client";

const RESEND_SECONDS = 60;
/** The 6-digit code only shows in e-mails once custom templates are on (needs custom SMTP). */
const CODE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_AUTH_OTP_CODE === "true";

type Status = "idle" | "sending" | "sent" | "verifying";

export function LoginForm({
  next,
  linkError,
  accountDeleted = false,
}: {
  next: string;
  linkError: boolean;
  accountDeleted?: boolean;
}) {
  const router = useRouter();
  const emailId = useId();
  const codeId = useId();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(
    linkError
      ? "Esse link expirou ou já foi usado. Peça um novo abaixo."
      : null,
  );
  const [cooldown, setCooldown] = useState(0);

  // After deleting the account, also erase this device's copy.
  useEffect(() => {
    // Loaded on demand: the login screen does not need the local database otherwise.
    if (accountDeleted)
      void import("@/lib/local/cleanup").then((m) => m.cleanDevice());
  }, [accountDeleted]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendLink(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError("Confira o e-mail: parece que falta alguma coisa.");
      return;
    }
    setStatus("sending");
    const supabase = otpClient();
    const redirect = new URL("/auth/link", window.location.origin);
    redirect.searchParams.set("next", next);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
    });
    if (err) {
      setStatus(status === "sent" ? "sent" : "idle");
      setError(authErrorMessage(err));
      return;
    }
    setEmail(parsed.data);
    setStatus("sent");
    setCooldown(RESEND_SECONDS);
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError("O código tem 6 números.");
      return;
    }
    setStatus("verifying");
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: parsed.data,
      type: "email",
    });
    if (err) {
      setStatus("sent");
      setError(authErrorMessage(err));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (status === "sent" || status === "verifying") {
    return (
      <div className="mt-10 flex flex-col gap-gap-card">
        <HeroCard className="px-5 pt-5 pb-6" aria-live="polite">
          <CapsLabel onLime>Confira seu e-mail</CapsLabel>
          <h1 className="mt-2 font-display text-[28px] leading-[1.15] font-extrabold">
            {CODE_LOGIN_ENABLED
              ? "Enviamos um código para entrar"
              : "Enviamos um link para entrar"}
          </h1>
          <p className="mt-2 text-[15px] font-semibold break-words text-lime-text">
            Para <strong className="font-extrabold text-ink">{email}</strong>.{" "}
            {CODE_LOGIN_ENABLED
              ? "Digite abaixo o código de 6 números do e-mail, ou toque em “Entrar no Km+” no próprio e-mail."
              : "Abra o e-mail e toque em “Sign in”."}
          </p>
        </HeroCard>

        {CODE_LOGIN_ENABLED ? (
          <form
            onSubmit={verifyCode}
            className="flex flex-col gap-gap-card"
            noValidate
          >
            <Card className="px-4 py-3">
              <label htmlFor={codeId} className="block label-caps text-muted">
                Código do e-mail
              </label>
              <input
                id={codeId}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-transparent py-1 font-display text-[30px] font-extrabold tracking-[0.2em] outline-none"
              />
            </Card>
            <Button type="submit" block disabled={status === "verifying"}>
              {status === "verifying" ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        ) : null}

        {error ? <ErrorState message={error} /> : null}

        <p className="px-1 text-[13px] font-semibold text-muted">
          Não chegou? Olhe a caixa de spam ou promoções.{" "}
          {CODE_LOGIN_ENABLED
            ? "O código vale por 1 hora."
            : "O link vale por 1 hora."}
        </p>
        <Button
          variant="secondary"
          block
          onClick={() => sendLink()}
          disabled={cooldown > 0}
        >
          {cooldown > 0
            ? `Reenviar em ${cooldown} s`
            : CODE_LOGIN_ENABLED
              ? "Reenviar o código"
              : "Reenviar o link"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setStatus("idle");
            setCode("");
            setError(null);
          }}
        >
          Usar outro e-mail
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={sendLink}
      className="mt-10 flex flex-col gap-gap-card"
      noValidate
    >
      {accountDeleted ? (
        <p
          role="status"
          className="rounded-card bg-lime px-4 py-3 text-[15px] font-bold"
        >
          Sua conta e seus dados foram excluídos.
        </p>
      ) : null}
      <header className="mb-2">
        <h1 className="font-display text-[32px] leading-[1.1] font-extrabold">
          Entre com seu e-mail
        </h1>
        <p className="mt-2 text-[15px] font-semibold text-muted">
          {CODE_LOGIN_ENABLED
            ? "Enviamos um código de acesso. Sem senha para lembrar."
            : "Enviamos um link de acesso. Sem senha para lembrar."}
        </p>
      </header>
      <Card className="px-4 py-3">
        <label htmlFor={emailId} className="block label-caps text-muted">
          E-mail
        </label>
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-transparent py-1.5 text-[19px] font-bold outline-none placeholder:text-muted/70"
        />
      </Card>
      {error ? <ErrorState message={error} /> : null}
      <Button type="submit" block disabled={status === "sending"}>
        {status === "sending" ? "Enviando…" : "Receber link de acesso"}
      </Button>
    </form>
  );
}
