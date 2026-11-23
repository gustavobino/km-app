"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { EXPENSE_LABELS, parseLiters, type ExpenseEntry } from "@/lib/day/form";
import { parseBRL } from "@/lib/money";
import { parseKm } from "@/lib/units";

type ExpenseSheetProps = {
  entry: ExpenseEntry | null;
  isNew: boolean;
  onSave: (entry: ExpenseEntry) => void;
  onRemove: (key: string) => void;
  onClose: () => void;
};

/** Value of one expense (remount with a new `key` per entry); fuel also takes liters, odometer and "full tank" (all optional). */
export function ExpenseSheet({
  entry,
  isNew,
  onSave,
  onRemove,
  onClose,
}: ExpenseSheetProps) {
  const [draft, setDraft] = useState<ExpenseEntry | null>(entry);
  const [error, setError] = useState<string | null>(null);
  const ids = {
    amount: useId(),
    liters: useId(),
    odometer: useId(),
    label: useId(),
  };

  if (!draft) return null;

  const isFuel = draft.category === "fuel";
  const isOther = draft.category === "other";

  function save() {
    if (!draft) return;
    const cents = parseBRL(draft.amount);
    if (cents == null || cents === 0)
      return setError("Informe o valor. Exemplo: 85,00");
    if (isFuel && draft.liters.trim() && parseLiters(draft.liters) == null)
      return setError("Litros inválidos. Exemplo: 32,5");
    if (isFuel && draft.odometer.trim() && parseKm(draft.odometer) == null)
      return setError("Odômetro: use só números, ex.: 52340");
    onSave(draft);
  }

  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      title={EXPENSE_LABELS[draft.category]}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-gap-card"
        noValidate
      >
        <Card className="px-4 py-3">
          <label htmlFor={ids.amount} className="block label-caps text-muted">
            Valor
          </label>
          <MoneyInput
            id={ids.amount}
            autoFocus
            value={draft.amount}
            onChange={(amount) => setDraft({ ...draft, amount })}
            placeholder="0,00"
          />
        </Card>
        {isOther ? (
          <Card className="px-4 py-3">
            <label htmlFor={ids.label} className="block label-caps text-muted">
              Descrição (opcional)
            </label>
            <input
              id={ids.label}
              maxLength={40}
              value={draft.label}
              placeholder="Ex.: manutenção"
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              className="h-touch w-full bg-transparent text-[17px] font-bold outline-none placeholder:text-muted/60"
            />
          </Card>
        ) : null}
        {isFuel ? (
          <>
            <div className="grid grid-cols-2 gap-gap-card">
              <Card className="px-4 py-3">
                <label
                  htmlFor={ids.liters}
                  className="block label-caps text-muted"
                >
                  Litros
                </label>
                <input
                  id={ids.liters}
                  inputMode="decimal"
                  value={draft.liters}
                  placeholder="opcional"
                  onChange={(e) =>
                    setDraft({ ...draft, liters: e.target.value })
                  }
                  className="h-touch w-full bg-transparent font-display text-[22px] font-extrabold outline-none placeholder:font-sans placeholder:text-[15px] placeholder:font-semibold placeholder:text-muted/70"
                />
              </Card>
              <Card className="px-4 py-3">
                <label
                  htmlFor={ids.odometer}
                  className="block label-caps text-muted"
                >
                  Odômetro
                </label>
                <input
                  id={ids.odometer}
                  inputMode="numeric"
                  value={draft.odometer}
                  placeholder="opcional"
                  onChange={(e) =>
                    setDraft({ ...draft, odometer: e.target.value })
                  }
                  className="h-touch w-full bg-transparent font-display text-[22px] font-extrabold outline-none placeholder:font-sans placeholder:text-[15px] placeholder:font-semibold placeholder:text-muted/70"
                />
              </Card>
            </div>
            <Card className="flex items-center justify-between px-4 py-1.5">
              <span className="text-[15px] font-bold">Enchi o tanque</span>
              <Switch
                label="Enchi o tanque"
                checked={draft.fullTank}
                onChange={(fullTank) => setDraft({ ...draft, fullTank })}
              />
            </Card>
            <p className="px-1 text-[13px] font-semibold text-muted">
              Com litros e odômetro a cada tanque cheio, o app calcula seu
              consumo (km/l).
            </p>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="px-1 text-[14px] font-bold">
            {error}
          </p>
        ) : null}
        <Button type="submit" block>
          {isNew ? "Adicionar gasto" : "Salvar gasto"}
        </Button>
        {!isNew ? (
          <Button variant="ghost" onClick={() => onRemove(draft.key)}>
            Remover este gasto
          </Button>
        ) : null}
      </form>
    </Sheet>
  );
}
