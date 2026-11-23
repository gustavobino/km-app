"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CapsLabel, Card, HeroCard } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { addDays, today, type LocalDate } from "@/lib/dates";
import {
  EXPENSE_LABELS,
  SHIFT_LABELS,
  emptyForm,
  formFromDay,
  liveSummary,
  newKey,
  parseDayForm,
  type DayForm,
  type ExpenseEntry,
  type FieldErrors,
} from "@/lib/day/form";
import { localDb } from "@/lib/local/db";
import { getLocalDay, saveLocalDay } from "@/lib/local/days";
import type {
  ExpenseCategory,
  PlatformSetting,
  Shift,
} from "@/lib/metrics/types";
import { formatBRL, parseBRL } from "@/lib/money";
import { DayHeader } from "./DayHeader";
import { EarningsCard } from "./EarningsCard";
import { ExpenseSheet } from "./ExpenseSheet";
import { useSync } from "./useSync";

const MAIN_CATEGORIES: ExpenseCategory[] = ["fuel", "food", "toll", "other"];
const EXTRA_CATEGORIES: ExpenseCategory[] = ["parking", "wash"];
const SHIFTS: Shift[] = ["morning", "afternoon", "evening", "night"];

type Props = {
  userId: string;
  apps: string[];
  platformSettings: PlatformSetting[];
};

type Saved = { at: number; offline: boolean };

export function RegisterDay({ userId, apps, platformSettings }: Props) {
  // Rendered only in the browser (see RegisterDayClient): the date comes from
  // the device, because the page HTML may be cached from another day.
  const [todayDate] = useState<LocalDate>(() => today());
  const [date, setDate] = useState<LocalDate>(todayDate);
  const [form, setForm] = useState<DayForm | null>(null);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showExtraChips, setShowExtraChips] = useState(false);
  const [sheet, setSheet] = useState<{
    entry: ExpenseEntry;
    isNew: boolean;
  } | null>(null);
  const sync = useSync(userId);
  const formRef = useRef<HTMLFormElement>(null);

  // `undefined` while loading, `null` when the day was never registered.
  const stored = useLiveQuery(
    async () => (await getLocalDay(localDb(), userId, date)) ?? null,
    [userId, date],
  );

  // Load the day into the form. A later change of the stored day (after saving,
  // or a sync pull) reloads it only if the driver is not in the middle of typing.
  const loadedFor = useRef<LocalDate | null>(null);
  useEffect(() => {
    if (stored === undefined) return;
    const firstLoad = loadedFor.current !== date;
    if (!firstLoad && touched) return;
    setForm(stored ? formFromDay(stored, apps) : emptyForm(date, apps));
    setErrors({});
    if (firstLoad) {
      loadedFor.current = date;
      setSaved(null);
      setMoreOpen(
        Boolean(
          stored &&
          (stored.isDayOff ||
            stored.shifts?.length ||
            stored.earnings.some((e) => e.minutes != null)),
        ),
      );
    }
    // Only react to a new stored version or a new date; `touched` is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, date]);

  const summary = useMemo(
    () => (form ? liveSummary(form, platformSettings) : null),
    [form, platformSettings],
  );

  if (!form || !summary) {
    return (
      <main
        aria-busy="true"
        className="mx-auto flex w-full max-w-column flex-col gap-gap-card px-5 pt-6"
      >
        <Skeleton className="h-16" />
        <Skeleton className="h-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
      </main>
    );
  }

  const isToday = date === todayDate;
  const isExisting = Boolean(stored);

  function update(patch: Partial<DayForm>) {
    setForm((f) => (f ? { ...f, ...patch } : f));
    setTouched(true);
    setSaved(null);
  }

  function goTo(d: LocalDate) {
    setTouched(false);
    setForm(null);
    setDate(d);
  }

  function openNewExpense(category: ExpenseCategory) {
    setSheet({
      isNew: true,
      entry: {
        key: newKey("x"),
        category,
        label: "",
        amount: "",
        liters: "",
        odometer: "",
        fullTank: false,
      },
    });
  }

  function saveExpense(entry: ExpenseEntry) {
    if (!form) return;
    const exists = form.expenses.some((x) => x.key === entry.key);
    update({
      expenses: exists
        ? form.expenses.map((x) => (x.key === entry.key ? entry : x))
        : [...form.expenses, entry],
    });
    setSheet(null);
  }

  async function closeDay() {
    if (!form) return;
    const result = parseDayForm(form, () => crypto.randomUUID());
    if (!result.ok) {
      setErrors(result.errors);
      // Move focus to the first invalid field so the driver sees what to fix.
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>("[aria-invalid='true']")
          ?.focus(),
      );
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await saveLocalDay(localDb(), userId, result.day, {
        newId: () => crypto.randomUUID(),
        now: new Date(),
      });
      setTouched(false);
      setSaved({ at: Date.now(), offline: !navigator.onLine });
      void sync.sync();
    } finally {
      setSaving(false);
    }
  }

  const usedCategories = new Set(form.expenses.map((x) => x.category));
  const chipCategories = [
    ...MAIN_CATEGORIES,
    ...(showExtraChips ? EXTRA_CATEGORIES : []),
  ];

  return (
    <main className="mx-auto flex w-full max-w-column flex-col gap-gap-card px-5 pt-6 pb-[calc(var(--spacing-tabbar)+24px+env(safe-area-inset-bottom))]">
      <DayHeader
        date={date}
        isToday={isToday}
        onPrev={() => goTo(addDays(date, -1))}
        onNext={isToday ? undefined : () => goTo(addDays(date, 1))}
        onToday={isToday ? undefined : () => goTo(todayDate)}
        sync={sync}
      />

      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void closeDay();
        }}
        className="flex flex-col gap-gap-card"
      >
        {form.isDayOff ? (
          <Card className="px-4 py-4">
            <CapsLabel>Dia de folga</CapsLabel>
            <p className="mt-1 text-[16px] font-bold">
              Descansar também faz parte. Bom descanso.
            </p>
          </Card>
        ) : (
          <>
            <EarningsCard
              rows={form.earnings}
              splitHours={form.splitHours}
              errors={errors}
              onChange={(earnings) => update({ earnings })}
            />
            <div className="grid grid-cols-2 gap-gap-card">
              <NumberField
                id="horas"
                label="Horas rodadas"
                unit="h"
                inputMode="decimal"
                value={form.hours}
                error={errors.hours}
                placeholder={form.splitHours ? "soma" : undefined}
                onChange={(hours) => update({ hours })}
              />
              <NumberField
                id="km"
                label="Km rodados"
                unit="km"
                inputMode="numeric"
                value={form.km}
                error={errors.km}
                onChange={(km) => update({ km })}
              />
            </div>
          </>
        )}

        <Card className="px-4 pt-3.5 pb-4">
          <div className="mb-2.5 flex items-center justify-between">
            <CapsLabel as="h2">Gastos do dia</CapsLabel>
            <span className="rounded-[10px] bg-bg px-2.5 py-0.75 text-xs font-bold text-muted">
              opcional
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.expenses.map((x) => (
              <Chip
                key={x.key}
                selected
                removable
                aria-label={`${EXPENSE_LABELS[x.category]}${x.label ? ` (${x.label})` : ""}, ${formatBRL(
                  parseBRL(x.amount) ?? 0,
                )}. Editar ou remover`}
                aria-invalid={errors[`expense:${x.key}`] ? true : undefined}
                onClick={() => setSheet({ entry: x, isNew: false })}
              >
                {x.label || EXPENSE_LABELS[x.category]} ·{" "}
                {formatBRL(parseBRL(x.amount) ?? 0, { symbol: false })}
              </Chip>
            ))}
            {chipCategories
              .filter((c) => c === "other" || !usedCategories.has(c))
              .map((c) => (
                <Chip key={c} onClick={() => openNewExpense(c)}>
                  + {EXPENSE_LABELS[c]}
                </Chip>
              ))}
            {!showExtraChips ? (
              <Chip
                onClick={() => setShowExtraChips(true)}
                aria-label="Mais tipos de gasto: estacionamento e lavagem"
              >
                + mais
              </Chip>
            ) : null}
          </div>
        </Card>

        <MoreOptions
          open={moreOpen}
          onToggle={() => setMoreOpen(!moreOpen)}
          form={form}
          onChange={update}
        />

        {errors.form ? (
          <p role="alert" className="px-1 text-[15px] font-bold">
            {errors.form}
          </p>
        ) : null}

        <div className="sticky bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] -mx-5 flex flex-col gap-gap-card bg-bg/95 px-5 pt-2 pb-3 backdrop-blur-sm">
          <HeroCard
            radius="hero-sm"
            className="flex h-17 items-center justify-between px-4.5"
          >
            <div aria-live="polite" className="contents">
              <div>
                <div className="text-xs font-extrabold text-lime-text">
                  {form.isDayOff
                    ? "Dia de folga"
                    : isToday
                      ? "Sobrou no bolso hoje"
                      : "Sobrou no bolso nesse dia"}
                </div>
                <div className="text-[13px] font-semibold text-lime-text">
                  {form.isDayOff
                    ? "Nada a registrar de ganhos"
                    : summary.grossPerHourCents != null
                      ? `${formatBRL(summary.grossPerHourCents)} por hora`
                      : "informe as horas"}
                </div>
              </div>
              <div className="font-display text-[32px] leading-none font-extrabold tracking-hero text-ink">
                {formatBRL(summary.netCents)}
              </div>
            </div>
          </HeroCard>
          <Button type="submit" block disabled={saving} className="h-13">
            {saving
              ? "Salvando…"
              : isExisting && !saved
                ? "Salvar alterações"
                : "Fechar o dia"}
          </Button>
          <p
            aria-live="polite"
            className={cn(
              "text-center text-[13px] font-bold",
              !saved && "sr-only",
            )}
          >
            {saved
              ? saved.offline
                ? "Dia salvo no aparelho. Envia sozinho quando voltar o sinal."
                : "Dia fechado e salvo."
              : ""}
          </p>
        </div>
      </form>

      <ExpenseSheet
        key={sheet?.entry.key ?? "closed"}
        entry={sheet?.entry ?? null}
        isNew={sheet?.isNew ?? true}
        onSave={saveExpense}
        onRemove={(key) => {
          update({ expenses: form.expenses.filter((x) => x.key !== key) });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </main>
  );
}

function NumberField(props: {
  id: string;
  label: string;
  unit: string;
  value: string;
  inputMode: "decimal" | "numeric";
  error?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${props.id}-erro`;
  return (
    <Card className={cn("px-4 py-3", props.error && "border-ink")}>
      <label htmlFor={props.id} className="block label-caps text-muted">
        {props.label}
      </label>
      <div className="flex items-baseline gap-1.5">
        <input
          id={props.id}
          inputMode={props.inputMode}
          autoComplete="off"
          value={props.value}
          placeholder={props.placeholder}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? errorId : undefined}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent py-1 font-display text-[28px] font-extrabold tracking-display outline-none placeholder:font-sans placeholder:text-[15px] placeholder:font-semibold placeholder:text-muted/70"
        />
        <span aria-hidden="true" className="font-bold text-muted">
          {props.unit}
        </span>
      </div>
      {props.error ? (
        <p id={errorId} className="text-[13px] font-bold">
          {props.error}
        </p>
      ) : null}
    </Card>
  );
}

function MoreOptions({
  open,
  onToggle,
  form,
  onChange,
}: {
  open: boolean;
  onToggle: () => void;
  form: DayForm;
  onChange: (patch: Partial<DayForm>) => void;
}) {
  const panelId = "mais-opcoes";
  return (
    <Card className="px-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex h-13 w-full items-center justify-between text-[15px] font-extrabold"
      >
        Mais opções
        <ChevronDownIcon
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="border-t border-divider pt-3 pb-3"
      >
        {!form.isDayOff ? (
          <>
            <CapsLabel as="h3" className="mb-2">
              Turnos
            </CapsLabel>
            <div
              role="group"
              aria-label="Turnos"
              className="flex flex-wrap gap-2"
            >
              {SHIFTS.map((s) => {
                const on = form.shifts.includes(s);
                return (
                  <Chip
                    key={s}
                    selected={on}
                    aria-pressed={on}
                    onClick={() =>
                      onChange({
                        shifts: on
                          ? form.shifts.filter((x) => x !== s)
                          : SHIFTS.filter(
                              (x) => x === s || form.shifts.includes(x),
                            ),
                      })
                    }
                  >
                    {SHIFT_LABELS[s]}
                  </Chip>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-divider pt-1">
              <span className="text-[15px] font-bold">
                Dividir horas entre apps
              </span>
              <Switch
                label="Dividir horas entre apps"
                checked={form.splitHours}
                onChange={(splitHours) => onChange({ splitHours })}
              />
            </div>
          </>
        ) : null}
        <div
          className={cn(
            "flex items-center justify-between",
            !form.isDayOff && "border-t border-divider pt-1",
          )}
        >
          <span className="text-[15px] font-bold">Dia de folga</span>
          <Switch
            label="Dia de folga"
            checked={form.isDayOff}
            onChange={(isDayOff) => onChange({ isDayOff })}
          />
        </div>
      </div>
    </Card>
  );
}
