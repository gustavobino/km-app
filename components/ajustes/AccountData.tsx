"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/(app)/ajustes/actions";
import { Button } from "@/components/ui/Button";
import { CapsLabel, Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";

/** LGPD: export everything as CSV, or delete the account for good. */
export function AccountData() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card
      as="section"
      aria-labelledby="dados"
      className="flex flex-col gap-3 px-4 pt-3.5 pb-4"
    >
      <CapsLabel as="h2" id="dados">
        Seus dados
      </CapsLabel>
      <p className="text-[13px] font-semibold text-muted">
        Baixe tudo o que você registrou (planilhas CSV num arquivo .zip).
        Precisa de internet.
      </p>
      <a
        href="/api/export"
        download
        className="flex h-13 items-center justify-center rounded-button border-[1.5px] border-chip-border bg-surface text-[16px] font-extrabold"
      >
        Exportar meus dados
      </a>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-touch text-[14px] font-bold text-muted underline underline-offset-4"
      >
        Excluir minha conta
      </button>

      {open ? (
        <Sheet open onClose={() => setOpen(false)} title="Excluir minha conta">
          <p className="text-[15px] font-semibold">
            Isso apaga sua conta e todos os seus registros, nesta tela e na
            nuvem. Não dá para desfazer. Se quiser, exporte seus dados antes.
          </p>
          <p className="text-[13px] font-semibold text-muted">
            O registro do pagamento é guardado sem vínculo com você, por
            obrigação fiscal. A compra não é reembolsada ao excluir a conta,
            exceto dentro da garantia de 7 dias.
          </p>
          <Card className="px-4 py-3">
            <label
              htmlFor="confirma-exclusao"
              className="block label-caps text-muted"
            >
              Digite EXCLUIR para confirmar
            </label>
            <input
              id="confirma-exclusao"
              autoComplete="off"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-10 w-full bg-transparent text-[18px] font-extrabold tracking-[0.1em] uppercase outline-none"
            />
          </Card>
          {error ? (
            <p role="alert" className="text-[14px] font-bold">
              {error}
            </p>
          ) : null}
          <Button
            block
            disabled={pending || text.trim().toUpperCase() !== "EXCLUIR"}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await deleteAccount(text);
                if (r && !r.ok) return setError(r.error);
              })
            }
          >
            {pending ? "Excluindo…" : "Excluir conta para sempre"}
          </Button>
        </Sheet>
      ) : null}
    </Card>
  );
}
