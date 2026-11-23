"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  deleteMaintenanceItem,
  saveMaintenanceItem,
} from "@/app/(app)/ajustes/actions";
import { Button } from "@/components/ui/Button";
import { CapsLabel, Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { isLocalDate } from "@/lib/dates";
import type { MaintenanceItem } from "@/lib/insights";
import { formatKm, parseKm } from "@/lib/units";

const SUGGESTIONS = [
  { name: "Troca de óleo", intervalKm: 10000 },
  { name: "Pneus (rodízio)", intervalKm: 10000 },
  { name: "Revisão", intervalKm: 20000 },
];

type Draft = {
  id: string | null;
  name: string;
  interval: string;
  lastKm: string;
  lastDate: string;
};

/** "Manutenção": items whose km feed the maintenance insight. */
export function MaintenanceList({ items }: { items: MaintenanceItem[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = {
    name: useId(),
    interval: useId(),
    lastKm: useId(),
    lastDate: useId(),
  };

  function open(
    item?: MaintenanceItem,
    suggestion?: { name: string; intervalKm: number },
  ) {
    setError(null);
    setDraft({
      id: item?.id ?? null,
      name: item?.name ?? suggestion?.name ?? "",
      interval: String(item?.intervalKm ?? suggestion?.intervalKm ?? ""),
      lastKm: item?.lastDoneKm != null ? String(item.lastDoneKm) : "",
      lastDate: item?.lastDoneDate ?? "",
    });
  }

  async function save() {
    if (!draft) return;
    const intervalKm = parseKm(draft.interval);
    const lastDoneKm = draft.lastKm.trim() ? parseKm(draft.lastKm) : null;
    if (!draft.name.trim()) return setError("Dê um nome, ex.: Troca de óleo.");
    if (intervalKm == null || intervalKm < 100)
      return setError("Informe a cada quantos km, ex.: 10000.");
    if (draft.lastKm.trim() && lastDoneKm == null)
      return setError("Km da última vez: use só números.");
    if (draft.lastDate && !isLocalDate(draft.lastDate))
      return setError("Confira a data.");
    if (lastDoneKm == null && !draft.lastDate)
      return setError("Informe o km ou a data da última vez.");
    setBusy(true);
    const r = await saveMaintenanceItem({
      id: draft.id,
      name: draft.name.trim(),
      intervalKm,
      lastDoneKm,
      lastDoneDate: draft.lastDate || null,
    }).catch(() => ({
      ok: false as const,
      error: "Sem internet agora. Tente de novo quando tiver sinal.",
    }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDraft(null);
    router.refresh();
  }

  async function remove() {
    if (!draft?.id) return;
    setBusy(true);
    const r = await deleteMaintenanceItem(draft.id).catch(() => ({
      ok: false as const,
      error: "Sem internet agora.",
    }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDraft(null);
    router.refresh();
  }

  return (
    <Card
      as="section"
      aria-labelledby="manutencao-titulo"
      className="px-4 pt-3.5 pb-4"
    >
      <CapsLabel as="h2" id="manutencao-titulo">
        Manutenção
      </CapsLabel>
      <p className="mt-1 text-[13px] font-semibold text-muted">
        Avisamos nos Insights quando estiver chegando a hora. Use os km do dia
        ou o odômetro do abastecimento.
      </p>
      {items.length > 0 ? (
        <ul className="mt-2">
          {items.map((item) => (
            <li key={item.id} className="border-t border-divider">
              <button
                type="button"
                onClick={() => open(item)}
                className="flex min-h-13 w-full items-center justify-between text-left"
              >
                <span className="text-[15px] font-bold">{item.name}</span>
                <span className="text-[13px] font-semibold text-muted">
                  a cada {formatKm(item.intervalKm)} km
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => open(undefined, s)}
              className="h-touch rounded-chip border-[1.5px] border-chip-border bg-surface px-3.5 text-sm font-bold"
            >
              + {s.name}
            </button>
          ))}
        </div>
      )}
      <Button variant="secondary" block className="mt-3" onClick={() => open()}>
        Adicionar item
      </Button>

      {draft ? (
        <Sheet
          open
          onClose={() => setDraft(null)}
          title={draft.id ? "Editar item" : "Novo item"}
        >
          <form
            noValidate
            className="flex flex-col gap-gap-card"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Field id={ids.name} label="Nome">
              <input
                id={ids.name}
                value={draft.name}
                maxLength={60}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="h-10 w-full bg-transparent text-[17px] font-bold outline-none"
              />
            </Field>
            <Field id={ids.interval} label="A cada quantos km">
              <input
                id={ids.interval}
                inputMode="numeric"
                value={draft.interval}
                onChange={(e) =>
                  setDraft({ ...draft, interval: e.target.value })
                }
                className="h-10 w-full bg-transparent font-display text-[22px] font-extrabold outline-none"
              />
            </Field>
            <div className="grid grid-cols-2 gap-gap-card">
              <Field id={ids.lastKm} label="Última vez: km">
                <input
                  id={ids.lastKm}
                  inputMode="numeric"
                  placeholder="odômetro"
                  value={draft.lastKm}
                  onChange={(e) =>
                    setDraft({ ...draft, lastKm: e.target.value })
                  }
                  className="h-10 w-full bg-transparent font-display text-[20px] font-extrabold outline-none placeholder:font-sans placeholder:text-[14px] placeholder:font-semibold placeholder:text-muted/70"
                />
              </Field>
              <Field id={ids.lastDate} label="Última vez: data">
                <input
                  id={ids.lastDate}
                  type="date"
                  value={draft.lastDate}
                  onChange={(e) =>
                    setDraft({ ...draft, lastDate: e.target.value })
                  }
                  className="h-10 w-full bg-transparent text-[15px] font-bold outline-none"
                />
              </Field>
            </div>
            {error ? (
              <p role="alert" className="text-[14px] font-bold">
                {error}
              </p>
            ) : null}
            <Button type="submit" block disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
            {draft.id ? (
              <Button
                variant="ghost"
                onClick={() => void remove()}
                disabled={busy}
              >
                Remover item
              </Button>
            ) : null}
          </form>
        </Sheet>
      ) : null}
    </Card>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="px-3.5 py-2.5">
      <label
        htmlFor={id}
        className="block text-[11px] font-bold tracking-[0.06em] text-muted uppercase"
      >
        {label}
      </label>
      {children}
    </Card>
  );
}
