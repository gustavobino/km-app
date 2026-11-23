"use client";

import { CapsLabel, Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  appLabel,
  newKey,
  type EarningRow,
  type FieldErrors,
} from "@/lib/day/form";

type Props = {
  rows: EarningRow[];
  splitHours: boolean;
  errors: FieldErrors;
  onChange: (rows: EarningRow[]) => void;
};

function Badge({ row }: { row: EarningRow }) {
  const text =
    row.source === "uber"
      ? "U"
      : row.source === "99"
        ? "99"
        : row.label.trim()
          ? row.label.trim()[0]!.toUpperCase()
          : "+";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 flex-none items-center justify-center rounded-[10px] text-sm font-extrabold",
        row.source === "uber" ? "bg-ink text-white" : "bg-app-chip-bg text-ink",
      )}
    >
      {text}
    </span>
  );
}

/** "Ganhos do dia": one row per app; extra "outro app" rows can be added. */
export function EarningsCard({ rows, splitHours, errors, onChange }: Props) {
  const set = (key: string, patch: Partial<EarningRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <Card className="px-4">
      <CapsLabel as="h2" className="pt-3.5 pb-2.5">
        Ganhos do dia
      </CapsLabel>
      {rows.map((row) => {
        const amountId = `ganho-${row.key}`;
        const nameId = `app-${row.key}`;
        const hoursId = `horas-${row.key}`;
        const error = errors[`earning:${row.key}`];
        const hoursError = errors[`earningHours:${row.key}`];
        const label = appLabel(row.source, row.label);
        return (
          <div key={row.key} className="border-t border-divider">
            <div className="flex min-h-13 items-center gap-3">
              <Badge row={row} />
              {row.custom ? (
                <>
                  <label htmlFor={nameId} className="sr-only">
                    Nome do outro app
                  </label>
                  <input
                    id={nameId}
                    value={row.label}
                    maxLength={40}
                    placeholder="Outro app"
                    onChange={(e) => set(row.key, { label: e.target.value })}
                    className="h-touch min-w-0 flex-1 bg-transparent text-[16px] font-bold outline-none placeholder:text-ink"
                  />
                </>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[16px] font-bold">
                  {label}
                </span>
              )}
              <label htmlFor={amountId} className="sr-only">
                Ganho {label}, em reais
              </label>
              <span aria-hidden="true" className="font-semibold text-muted">
                R$
              </span>
              <input
                id={amountId}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={row.amount}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${amountId}-erro` : undefined}
                onChange={(e) =>
                  set(row.key, {
                    amount: e.target.value.replace(/[^\d.,]/g, ""),
                  })
                }
                className="w-24 bg-transparent py-2 text-right font-display text-[22px] font-extrabold tracking-display outline-none placeholder:text-muted/40"
              />
            </div>
            {splitHours ? (
              <div className="flex items-center justify-end gap-2 pb-2">
                <label
                  htmlFor={hoursId}
                  className="text-[13px] font-semibold text-muted"
                >
                  Horas na {label}
                </label>
                <input
                  id={hoursId}
                  inputMode="decimal"
                  placeholder="0"
                  value={row.hours}
                  aria-invalid={hoursError ? true : undefined}
                  onChange={(e) => set(row.key, { hours: e.target.value })}
                  className="h-10 w-16 rounded-segment-item bg-bg px-2 text-right font-display text-[17px] font-extrabold outline-none"
                />
                <span
                  aria-hidden="true"
                  className="text-[13px] font-bold text-muted"
                >
                  h
                </span>
              </div>
            ) : null}
            {error || hoursError ? (
              <p
                id={`${amountId}-erro`}
                className="pb-2 text-right text-[13px] font-bold"
              >
                {error ?? hoursError}
              </p>
            ) : null}
          </div>
        );
      })}
      <div className="border-t border-divider">
        <button
          type="button"
          onClick={() =>
            onChange([
              ...rows,
              {
                key: newKey("e"),
                source: "other",
                label: "",
                custom: true,
                amount: "",
                hours: "",
              },
            ])
          }
          className="h-touch text-[14px] font-extrabold"
        >
          + adicionar outro app
        </button>
      </div>
    </Card>
  );
}
