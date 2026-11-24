"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { savePlatformSetting } from "@/app/(app)/ajustes/actions";
import { Button } from "@/components/ui/Button";
import { CapsLabel, Card } from "@/components/ui/Card";
import { ChoiceList } from "@/components/ui/ChoiceList";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { appLabel } from "@/lib/day/form";
import type { PlatformSetting } from "@/lib/metrics/types";
import { formatBRL, parseBRL, toInputBRL } from "@/lib/money";

const MODES = [
  {
    value: "net_already",
    label: "Já lanço o que recebi",
    hint: "O padrão: o valor que você digita já é o que caiu pra você.",
  },
  {
    value: "percent",
    label: "Percentual por corrida",
    hint: "Você lança o valor cheio e o app desconta a taxa.",
  },
  {
    value: "pass",
    label: "Passe ou assinatura",
    hint: "Um valor fixo por dia, semana ou mês.",
  },
] as const;
const PERIODS = [
  { value: "day", label: "Por dia" },
  { value: "week", label: "Por semana" },
  { value: "month", label: "Por mês" },
] as const;
const PERIOD_TEXT = { day: "dia", week: "semana", month: "mês" } as const;

function describe(s: PlatformSetting): string {
  if (s.mode === "percent")
    return `${String(s.percent).replace(".", ",")}% por corrida`;
  if (s.mode === "pass")
    return `passe de ${formatBRL(s.passCents ?? 0)} por ${PERIOD_TEXT[s.passPeriod ?? "week"]}`;
  return "já lanço o que recebi";
}

/** How each app charges the driver (affects "Sobrou no bolso"). */
export function PlatformFees({ settings }: { settings: PlatformSetting[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PlatformSetting | null>(null);
  const [mode, setMode] = useState<PlatformSetting["mode"]>("net_already");
  const [percent, setPercent] = useState("");
  const [pass, setPass] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { percent: useId(), pass: useId() };

  function open(s: PlatformSetting) {
    setEditing(s);
    setMode(s.mode);
    setPercent(s.percent != null ? String(s.percent).replace(".", ",") : "");
    setPass(toInputBRL(s.passCents));
    setPeriod(s.passPeriod ?? "week");
    setError(null);
  }

  async function save() {
    if (!editing) return;
    const pct = percent.trim() ? Number(percent.replace(",", ".")) : null;
    const passCents = pass.trim() ? parseBRL(pass) : null;
    if (mode === "percent" && (pct == null || !(pct >= 0 && pct <= 100)))
      return setError("Informe o percentual, de 0 a 100.");
    if (mode === "pass" && passCents == null)
      return setError("Informe o valor do passe.");
    setBusy(true);
    const r = await savePlatformSetting({
      source: editing.source,
      label: editing.label,
      mode,
      percent: mode === "percent" ? pct : null,
      passCents: mode === "pass" ? passCents : null,
      passPeriod: mode === "pass" ? period : null,
    }).catch(() => ({
      ok: false as const,
      error: "Sem internet agora. Tente de novo quando tiver sinal.",
    }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setEditing(null);
    router.refresh();
  }

  if (settings.length === 0) return null;
  return (
    <Card as="section" aria-labelledby="taxas" className="px-4 pt-3.5 pb-2">
      <CapsLabel as="h2" id="taxas">
        Como cada app te paga
      </CapsLabel>
      <ul className="mt-1">
        {settings.map((s) => (
          <li
            key={`${s.source}:${s.label ?? ""}`}
            className="border-t border-divider first:border-t-0"
          >
            <button
              type="button"
              onClick={() => open(s)}
              className="flex min-h-13 w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-[15px] font-bold">
                {appLabel(s.source, s.label)}
              </span>
              <span className="text-right text-[13px] font-semibold text-muted">
                {describe(s)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing ? (
        <Sheet
          open
          onClose={() => setEditing(null)}
          title={appLabel(editing.source, editing.label)}
        >
          <ChoiceList
            legend="Como esse app te paga"
            choices={MODES}
            value={mode}
            onChange={setMode}
          />
          {mode === "percent" ? (
            <Card className="px-4 py-3">
              <label
                htmlFor={ids.percent}
                className="block label-caps text-muted"
              >
                Taxa do app
              </label>
              <div className="flex items-baseline gap-1">
                <input
                  id={ids.percent}
                  inputMode="decimal"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  className="h-10 w-20 bg-transparent font-display text-[26px] font-extrabold outline-none"
                />
                <span className="font-bold text-muted">%</span>
              </div>
            </Card>
          ) : null}
          {mode === "pass" ? (
            <>
              <Card className="px-4 py-3">
                <label
                  htmlFor={ids.pass}
                  className="block label-caps text-muted"
                >
                  Valor do passe
                </label>
                <MoneyInput
                  id={ids.pass}
                  value={pass}
                  onChange={setPass}
                  placeholder="0,00"
                />
              </Card>
              <Segmented
                label="Periodicidade do passe"
                options={PERIODS}
                value={period}
                onChange={setPeriod}
              />
            </>
          ) : null}
          {error ? (
            <p role="alert" className="text-[14px] font-bold">
              {error}
            </p>
          ) : null}
          <Button block disabled={busy} onClick={() => void save()}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </Sheet>
      ) : null}
    </Card>
  );
}
