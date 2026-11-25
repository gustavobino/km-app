"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import type { PerKmBreakdown } from "@/lib/metrics/vehicle";
import { findVehicleModel, VEHICLE_MODELS } from "@/lib/metrics/vehicle-models";
import { formatBRL, parseBRL, toInputBRL } from "@/lib/money";
import type { VehicleContext } from "@/lib/profile/vehicle-server";
import type { VehicleInput } from "@/lib/schemas/vehicle";

type Props = {
  context: VehicleContext;
  perKm: PerKmBreakdown;
  onClose: () => void;
  onSave: (input: VehicleInput) => Promise<{ ok: boolean; error?: string }>;
};

const OWNERSHIP = [
  { value: "own", label: "Próprio" },
  { value: "rented", label: "Alugado" },
  { value: "financed", label: "Financiado" },
] as const;
const CATEGORIES = [
  { value: "compact", label: "Compacto" },
  { value: "sedan", label: "Sedã" },
  { value: "suv", label: "SUV" },
  { value: "other", label: "Outro" },
] as const;
const PERIODS = [
  { value: "day", label: "Por dia" },
  { value: "week", label: "Por semana" },
  { value: "month", label: "Por mês" },
] as const;

const perKmText = (v: number | null) =>
  v == null ? "" : toInputBRL(Math.round(v));

/** Editable car values. Every field is optional; empty per-km fields use the reference estimate. */
export function VehicleSheet({ context, perKm, onClose, onSave }: Props) {
  const v = context.vehicle;
  const [ownership, setOwnership] = useState(context.ownership);
  const [brand, setBrand] = useState(v?.brand ?? "");
  const [model, setModel] = useState(v?.model ?? "");
  const [year, setYear] = useState(v?.year ? String(v.year) : "");
  const [category, setCategory] = useState(v?.category ?? null);
  const [rent, setRent] = useState(toInputBRL(v?.rentCents));
  const [rentPeriod, setRentPeriod] = useState(v?.rentPeriod ?? "week");
  const [installment, setInstallment] = useState(
    toInputBRL(v?.installmentCents),
  );
  const [insurance, setInsurance] = useState(toInputBRL(v?.insuranceYearCents));
  const [ipva, setIpva] = useState(toInputBRL(v?.ipvaYearCents));
  const [maintenance, setMaintenance] = useState(
    perKmText(v?.maintenanceCentsPerKm ?? null),
  );
  const [tires, setTires] = useState(perKmText(v?.tiresCentsPerKm ?? null));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const known = findVehicleModel(brand, model);

  function money(text: string, label: string): number | null | undefined {
    if (!text.trim()) return null;
    const c = parseBRL(text);
    if (c == null) {
      setError(`Confira o valor de ${label}.`);
      return undefined;
    }
    return c;
  }

  async function submit() {
    setError(null);
    const y = year.trim() ? Number(year) : null;
    if (y != null && (!Number.isInteger(y) || y < 1980 || y > 2100))
      return setError("Confira o ano do carro.");
    const values = {
      rentCents: money(rent, "aluguel"),
      installmentCents: money(installment, "parcela"),
      insuranceYearCents: money(insurance, "seguro"),
      ipvaYearCents: money(ipva, "IPVA"),
      maintenanceCentsPerKm: money(maintenance, "manutenção por km"),
      tiresCentsPerKm: money(tires, "pneus por km"),
    };
    if (Object.values(values).some((x) => x === undefined)) return;
    setSaving(true);
    const r = await onSave({
      ownership,
      brand: brand.trim() || null,
      model: model.trim() || null,
      year: y,
      category: category ?? known?.category ?? null,
      rentCents: values.rentCents ?? null,
      rentPeriod: values.rentCents != null ? rentPeriod : null,
      installmentCents: values.installmentCents ?? null,
      insuranceYearCents: values.insuranceYearCents ?? null,
      ipvaYearCents: values.ipvaYearCents ?? null,
      maintenanceCentsPerKm: values.maintenanceCentsPerKm ?? null,
      tiresCentsPerKm: values.tiresCentsPerKm ?? null,
    });
    setSaving(false);
    if (!r.ok) setError(r.error ?? "Não deu para salvar agora.");
  }

  return (
    <Sheet open onClose={onClose} title="Valores do carro">
      <form
        className="flex max-h-[70dvh] flex-col gap-gap-card overflow-y-auto pb-1"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-[13px] font-semibold text-muted">
          Tudo opcional. O que ficar em branco usa uma estimativa de referência.
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 label-caps text-muted">O carro é</legend>
          <div className="flex flex-wrap gap-2">
            {OWNERSHIP.map((o) => (
              <Chip
                key={o.value}
                selected={ownership === o.value}
                aria-pressed={ownership === o.value}
                onClick={() => setOwnership(o.value)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-gap-card">
          <TextField
            id={`${id}-brand`}
            label="Marca"
            value={brand}
            onChange={setBrand}
            placeholder="Ex.: Chevrolet"
          />
          <TextField
            id={`${id}-model`}
            label="Modelo"
            value={model}
            onChange={setModel}
            placeholder="Ex.: Kwid"
            list={`${id}-models`}
          />
          <datalist id={`${id}-models`}>
            {VEHICLE_MODELS.map((m) => (
              <option key={m.id} value={m.model} />
            ))}
          </datalist>
        </div>
        <p
          aria-live="polite"
          className="-mt-1 px-1 text-[13px] font-semibold text-muted"
        >
          {known
            ? `Reconhecemos: ${known.brand} ${known.model}. A reserva usa as médias desse modelo (estimativa).`
            : model.trim()
              ? "Modelo fora da nossa lista: usamos a média do tipo de carro."
              : null}
        </p>
        <div className="grid grid-cols-[1fr_2fr] gap-gap-card">
          <TextField
            id={`${id}-year`}
            label="Ano"
            value={year}
            onChange={setYear}
            inputMode="numeric"
            placeholder="2021"
          />
          <fieldset className="flex flex-col">
            <legend className="mb-2 label-caps text-muted">Tipo</legend>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.value}
                  className="h-10 px-3 text-[13px]"
                  selected={category === c.value}
                  aria-pressed={category === c.value}
                  onClick={() => setCategory(c.value)}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          </fieldset>
        </div>

        {ownership === "rented" ? (
          <>
            <MoneyField
              id={`${id}-rent`}
              label="Aluguel"
              value={rent}
              onChange={setRent}
            />
            <Segmented
              label="Periodicidade do aluguel"
              options={PERIODS}
              value={rentPeriod}
              onChange={setRentPeriod}
            />
          </>
        ) : null}
        {ownership === "financed" ? (
          <MoneyField
            id={`${id}-installment`}
            label="Parcela por mês"
            value={installment}
            onChange={setInstallment}
          />
        ) : null}

        <div className="grid grid-cols-2 gap-gap-card">
          <MoneyField
            id={`${id}-insurance`}
            label="Seguro por ano"
            value={insurance}
            onChange={setInsurance}
          />
          <MoneyField
            id={`${id}-ipva`}
            label="IPVA por ano"
            value={ipva}
            onChange={setIpva}
          />
        </div>
        <div className="grid grid-cols-2 gap-gap-card">
          <MoneyField
            id={`${id}-maint`}
            label="Manutenção por km"
            value={maintenance}
            onChange={setMaintenance}
            placeholder={toInputBRL(
              Math.round(
                perKm.maintenanceSource === "driver" ? 0 : perKm.maintenance,
              ),
            )}
            hint={
              perKm.maintenanceSource === "history"
                ? "estimado dos seus gastos"
                : known
                  ? "em branco = média do modelo"
                  : "em branco = referência"
            }
          />
          <MoneyField
            id={`${id}-tires`}
            label="Pneus por km"
            value={tires}
            onChange={setTires}
            placeholder={toInputBRL(
              Math.round(perKm.tiresSource === "driver" ? 0 : perKm.tires),
            )}
            hint={known ? "em branco = média do modelo" : "em branco = referência"}
          />
        </div>
        <p className="text-[12px] font-semibold text-muted">
          Hoje a reserva está em ≈ {formatBRL(Math.round(perKm.total))} por km.
          É uma estimativa, não uma conta exata.
        </p>

        {error ? (
          <p role="alert" className="text-[14px] font-bold">
            {error}
          </p>
        ) : null}
        <Button type="submit" block disabled={saving}>
          {saving ? "Salvando…" : "Salvar valores"}
        </Button>
      </form>
    </Sheet>
  );
}

function FieldCard({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
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
      {hint ? (
        <div className="text-[11px] font-semibold text-muted">{hint}</div>
      ) : null}
    </Card>
  );
}

function TextField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric";
  list?: string;
}) {
  return (
    <FieldCard id={props.id} label={props.label}>
      <input
        id={props.id}
        value={props.value}
        inputMode={props.inputMode}
        list={props.list}
        autoComplete="off"
        maxLength={props.inputMode ? 4 : 60}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="h-10 w-full bg-transparent text-[16px] font-bold outline-none placeholder:text-muted/60"
      />
    </FieldCard>
  );
}

function MoneyField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <FieldCard id={props.id} label={props.label} hint={props.hint}>
      <MoneyInput
        id={props.id}
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder ?? "0,00"}
        sizeClass="text-[20px]"
      />
    </FieldCard>
  );
}
