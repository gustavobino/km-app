"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { startCheckout } from "@/app/comprar/actions";
import { Button } from "@/components/ui/Button";
import { CapsLabel, Card, HeroCard } from "@/components/ui/Card";
import { ShieldIcon } from "@/components/ui/icons";
import { HeroMoney } from "@/components/ui/Money";
import { ErrorState } from "@/components/ui/States";
import { formatBRL } from "@/lib/money";

type Props = {
  priceCents: number;
  refundDays: number;
  state: "idle" | "waiting" | "failed";
};

const INCLUDED = [
  "Registro do dia em 20 segundos, mesmo sem internet",
  "Painel de hoje, da semana e do mês",
  "Ganho por hora, por km e Uber × 99",
  "Lucro líquido e Reserva do carro",
  "Simulador de meta com caminhos",
  "Insights da semana",
];

const POLL_MS = 4000;
const POLL_FOR_MS = 10 * 60 * 1000;

export function Purchase({ priceCents, refundDays, state }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [checking, setChecking] = useState(state === "waiting");

  // After returning from the checkout: wait for the webhook to confirm the payment.
  useEffect(() => {
    if (state !== "waiting") return;
    const started = Date.now();
    let stopped = false;
    async function check() {
      try {
        const res = await fetch("/api/entitlement", { cache: "no-store" });
        if (res.ok && ((await res.json()) as { app: boolean }).app) {
          stopped = true;
          router.replace("/registrar");
          router.refresh();
          return;
        }
      } catch {
        // Offline for a moment: try again on the next tick.
      }
      if (Date.now() - started > POLL_FOR_MS) {
        stopped = true;
        setChecking(false);
      }
    }
    const t = setInterval(() => {
      if (!stopped) void check();
    }, POLL_MS);
    void check();
    return () => clearInterval(t);
  }, [state, router]);

  const price = formatBRL(priceCents);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-column flex-col gap-gap-card px-5 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <span className="font-display text-[22px] font-extrabold tracking-hero">
          Km+
        </span>
        <Link
          href="/ajustes"
          className="flex h-touch items-center text-[14px] font-bold text-muted"
        >
          Minha conta
        </Link>
      </div>

      {state === "waiting" ? (
        <HeroCard aria-live="polite" className="px-5 pt-5 pb-5">
          <CapsLabel onLime>Pedido recebido</CapsLabel>
          <h1 className="mt-2 font-display text-[28px] leading-[1.15] font-extrabold">
            {checking
              ? "Confirmando seu pagamento…"
              : "Ainda não chegou a confirmação"}
          </h1>
          <p className="mt-2 text-[15px] font-semibold text-lime-text">
            {checking
              ? "Pix costuma levar alguns segundos, às vezes alguns minutos. Esta tela abre o app sozinha quando confirmar."
              : "Se você já pagou, aguarde um pouco e toque em verificar. Se não pagou, pode tentar de novo abaixo."}
          </p>
          {!checking ? (
            <Button className="mt-4" block onClick={() => router.refresh()}>
              Verificar de novo
            </Button>
          ) : null}
        </HeroCard>
      ) : (
        <>
          <header className="mt-2">
            <h1 className="font-display text-[30px] leading-[1.1] font-extrabold">
              Saiba quanto sobra no seu bolso
            </h1>
            <p className="mt-2 text-[15px] font-semibold text-muted">
              Um pagamento só. Sem mensalidade, sem assinatura.
            </p>
          </header>
          {state === "failed" ? (
            <ErrorState message="O pagamento não foi concluído. Você pode tentar de novo." />
          ) : null}
        </>
      )}

      <HeroCard className="px-5 pt-4.5 pb-5">
        <CapsLabel as="h2" onLime>
          Km+ completo · pagamento único
        </CapsLabel>
        <HeroMoney value={priceCents} className="mt-1.5" />
        <p className="mt-1 text-[14px] font-bold text-lime-text">
          Pix ou cartão, pelo Mercado Pago
        </p>
      </HeroCard>

      <Card as="section" aria-labelledby="inclui" className="px-4 pt-3.5 pb-3">
        <CapsLabel as="h2" id="inclui" className="mb-1">
          O que você leva
        </CapsLabel>
        <ul>
          {INCLUDED.map((item) => (
            <li
              key={item}
              className="flex min-h-11 items-center gap-3 border-t border-divider text-[15px] font-bold first:border-t-0"
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-none"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex gap-3.5 px-4 py-3.5">
        <span
          aria-hidden="true"
          className="flex size-11 flex-none items-center justify-center rounded-[14px] bg-bg"
        >
          <ShieldIcon />
        </span>
        <div>
          <h2 className="text-[15px] font-extrabold">
            {refundDays} dias de garantia
          </h2>
          <p className="mt-0.5 text-[13px] font-semibold text-muted">
            Não gostou? Peça o reembolso em até {refundDays} dias da compra e
            devolvemos 100% do valor.
          </p>
        </div>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      {state === "waiting" && checking ? null : (
        <div className="sticky bottom-0 -mx-5 mt-auto bg-bg/95 px-5 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-sm">
          <Button
            block
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await startCheckout();
                if (r && !r.ok) setError(r.error);
              })
            }
          >
            {pending ? "Abrindo o pagamento…" : `Comprar por ${price}`}
          </Button>
          <p className="mt-2 text-center text-[12px] font-semibold text-muted">
            Ao comprar, você concorda com os{" "}
            <Link href="/termos" className="underline underline-offset-2">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="underline underline-offset-2">
              Política de privacidade
            </Link>
            . Km+ não é afiliado à Uber nem à 99.
          </p>
        </div>
      )}
    </main>
  );
}
