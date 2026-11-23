"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveVehicle, setVehicleMode } from "@/app/(app)/painel/lucro/actions";
import { Screen } from "@/components/layout/Screen";
import { LinkButton, Button } from "@/components/ui/Button";
import { CapsLabel, Card, HeroCard } from "@/components/ui/Card";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { HeroMoney } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import {
  addDays,
  formatMonthName,
  formatMonthYear,
  monthRange,
  today,
  type LocalDate,
} from "@/lib/dates";
import { EXPENSE_LABELS } from "@/lib/day/form";
import { localDb } from "@/lib/local/db";
import { listLocalDays } from "@/lib/local/days";
import { summarizeRange } from "@/lib/metrics/period";
import type { ExpenseCategory, PlatformSetting } from "@/lib/metrics/types";
import {
  RESERVE_HISTORY_DAYS,
  monthReserve,
} from "@/lib/metrics/month-reserve";
import { formatBRL, formatPercent } from "@/lib/money";
import type { VehicleContext } from "@/lib/profile/vehicle-server";
import { VehicleSheet } from "./VehicleSheet";

type Props = {
  userId: string;
  platformSettings: PlatformSetting[];
  vehicleContext: VehicleContext;
};

const CATEGORY_ORDER: ExpenseCategory[] = [
  "fuel",
  "food",
  "toll",
  "parking",
  "wash",
  "other",
];
const OWNERSHIP_TEXT = {
  own: "carro próprio",
  rented: "carro alugado",
  financed: "carro financiado",
} as const;
const CATEGORY_TEXT = {
  compact: "compacto",
  sedan: "sedã",
  suv: "SUV",
  other: "",
} as const;

export function Lucro({ userId, platformSettings, vehicleContext }: Props) {
  const [todayDate] = useState<LocalDate>(() => today());
  const [ctx, setCtx] = useState(vehicleContext);
  const [modeOn, setModeOn] = useState(vehicleContext.vehicleModeEnabled);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const month = useMemo(() => monthRange(todayDate), [todayDate]);
  const historyStart = addDays(todayDate, -RESERVE_HISTORY_DAYS);
  const from = historyStart < month.start ? historyStart : month.start;
  const days = useLiveQuery(
    () => listLocalDays(localDb(), userId, { start: from, end: month.end }),
    [userId, from],
  );

  const data = useMemo(() => {
    if (!days) return null;
    const monthDays = days.filter(
      (d) => d.date >= month.start && d.date <= month.end,
    );
    const summary = summarizeRange(days, month, platformSettings, todayDate);
    const byCategory = new Map<ExpenseCategory, number>();
    for (const x of monthDays.flatMap((d) => d.expenses)) {
      byCategory.set(
        x.category,
        (byCategory.get(x.category) ?? 0) + x.amountCents,
      );
    }
    const { reserve } = monthReserve(days, todayDate, ctx, platformSettings);
    return { summary, byCategory, reserve };
  }, [days, ctx, platformSettings, todayDate, month]);

  const header = (
    <header className="flex items-center gap-2">
      <Link
        href="/painel"
        aria-label="Voltar ao painel"
        className="-ml-2.5 flex size-touch items-center justify-center"
      >
        <ArrowLeftIcon />
      </Link>
      <div>
        <h1 className="font-display text-[26px] leading-[1.1] font-extrabold">
          Lucro líquido
        </h1>
        <div className="text-[13px] font-semibold text-muted">
          {formatMonthYear(todayDate)}
        </div>
      </div>
    </header>
  );

  if (!data) {
    return (
      <Screen className="pt-5">
        {header}
        <div aria-busy="true" className="flex flex-col gap-gap-card">
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-40 rounded-hero" />
          <Skeleton className="h-48" />
        </div>
      </Screen>
    );
  }

  const { summary, byCategory, reserve } = data;
  const monthName = formatMonthName(todayDate);

  if (summary.grossCents === 0 && summary.expensesCents === 0) {
    return (
      <Screen className="pt-5">
        {header}
        <EmptyState
          title={`Nenhum dia registrado em ${monthName}`}
          description="Assim que você registrar, o lucro do mês aparece aqui."
          action={
            <LinkButton href="/registrar" block>
              Registrar o dia
            </LinkButton>
          }
        />
      </Screen>
    );
  }

  const kept =
    summary.grossCents > 0
      ? Math.max(0, summary.netCents / summary.grossCents)
      : 0;
  const v = ctx.vehicle;
  const carName = [v?.model || v?.brand, v?.year].filter(Boolean).join(" · ");
  const carLine = [
    carName || (v?.category ? `Carro ${CATEGORY_TEXT[v.category]}`.trim() : ""),
    ctx.ownership ? OWNERSHIP_TEXT[ctx.ownership] : "",
  ]
    .filter(Boolean)
    .join(" · ");

  function toggleMode(next: boolean) {
    setError(null);
    setModeOn(next);
    startTransition(async () => {
      const r = await setVehicleMode(next).catch(() => ({
        ok: false as const,
        error: "Sem internet agora. Tente de novo quando tiver sinal.",
      }));
      if (!r.ok) {
        setModeOn(!next);
        setError(r.error);
      }
    });
  }

  const reserveParts = [
    "manutenção",
    "pneus",
    ...(v?.insuranceYearCents ? ["seguro"] : []),
    ...(v?.ipvaYearCents ? ["IPVA"] : []),
    ...(reserve.fixedPartCents > 0
      ? [ctx.ownership === "rented" ? "aluguel" : "parcela"]
      : []),
  ];

  return (
    <Screen className="pt-5">
      {header}

      <HeroCard className="px-5 pt-5 pb-5.5">
        <CapsLabel as="h2" onLime>
          Sobrou no bolso em {monthName}
        </CapsLabel>
        <HeroMoney value={summary.netCents} size="lg" className="mt-1" />
        <ProgressBar
          ratio={kept}
          onLime
          className="mt-3.5 mb-2.5"
          label={`${formatPercent(kept)} do que você ganhou ficou com você`}
        />
        <p className="text-sm font-bold text-lime-text">
          {formatPercent(kept)} do que você ganhou ficou com você
        </p>
      </HeroCard>

      <Card
        as="section"
        aria-label="Como chegamos nesse valor"
        className="px-4 py-1"
      >
        <Row
          label="Ganhos do mês"
          value={formatBRL(summary.grossCents)}
          strong
        />
        {summary.platformFeeCents > 0 ? (
          <Row
            label="Taxas dos apps"
            value={`− ${formatBRL(summary.platformFeeCents)}`}
          />
        ) : null}
        {CATEGORY_ORDER.filter((c) => byCategory.get(c)).map((c) => (
          <Row
            key={c}
            label={
              EXPENSE_LABELS[c] === "Outro"
                ? "Outros gastos"
                : EXPENSE_LABELS[c]
            }
            value={`− ${formatBRL(byCategory.get(c)!)}`}
          />
        ))}
        <div className="flex h-13 items-center justify-between border-t-[1.5px] border-ink">
          <span className="text-[15px] font-extrabold">Sobrou no bolso</span>
          <span className="rounded-[10px] bg-lime px-2.5 py-0.5 font-display text-[22px] font-extrabold">
            {formatBRL(summary.netCents)}
          </span>
        </div>
      </Card>

      <Card as="section" aria-label="Modo veículo" className="px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CapsLabel as="h2">Modo veículo · opcional</CapsLabel>
            <div className="mt-0.5 text-[15px] leading-snug font-extrabold">
              {carLine || "Seu carro"}
            </div>
          </div>
          <Switch
            label="Modo veículo"
            checked={modeOn}
            disabled={pending}
            onChange={toggleMode}
          />
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-[13px] font-bold">
            {error}
          </p>
        ) : null}
        {modeOn ? (
          <>
            <div className="mt-3 flex items-start justify-between gap-3 border-t border-divider pt-3">
              <div>
                <div className="text-[15px] font-bold">Reserva do carro</div>
                <p className="mt-0.5 max-w-[230px] text-[13px] font-semibold text-muted">
                  <span className="mr-1.5 inline-block rounded-[6px] bg-bg px-1.5 py-px align-[1px] text-[10px] font-extrabold tracking-[0.06em] uppercase">
                    estimativa
                  </span>
                  ≈ {formatBRL(Math.round(reserve.perKm.total))} por km
                  {reserve.fixedPartCents > 0
                    ? ` + ${ctx.ownership === "rented" ? "aluguel" : "parcela"} por dia`
                    : ""}
                  , para{" "}
                  {reserveParts.join(", ").replace(/, ([^,]*)$/, " e $1")}
                </p>
              </div>
              <span className="text-[16px] font-extrabold whitespace-nowrap">
                {formatBRL(reserve.reserveCents)}
              </span>
            </div>
            <div className="mt-3 flex flex-col rounded-[18px] bg-lime px-4 pt-3 pb-3.5">
              <span className="text-[13px] font-extrabold text-lime-text">
                Livre depois da reserva
              </span>
              <span className="font-display text-[32px] leading-[1.1] font-extrabold">
                {formatBRL(reserve.freeAfterReserveCents)}
              </span>
            </div>
            <p className="mt-3 text-[12px] font-semibold text-muted">
              {reserve.perKm.usesPlaceholder
                ? "Valores de referência provisórios. Para ficar mais perto da sua realidade, informe os dados do seu carro."
                : "Estimativa com os valores que você informou."}{" "}
              Não é aconselhamento financeiro.
            </p>
            <Button
              variant="secondary"
              block
              className="mt-3"
              onClick={() => setEditing(true)}
            >
              Editar valores
            </Button>
          </>
        ) : (
          <p className="mt-2 text-[13px] font-semibold text-muted">
            Ligue para ver quanto separar para manutenção, pneus, seguro e IPVA,
            e quanto fica livre depois disso.
          </p>
        )}
      </Card>

      {editing ? (
        <VehicleSheet
          context={ctx}
          perKm={reserve.perKm}
          onClose={() => setEditing(false)}
          onSave={async (input) => {
            const r = await saveVehicle(input).catch(() => ({
              ok: false as const,
              error: "Sem internet agora. Tente de novo quando tiver sinal.",
            }));
            if (r.ok) {
              setCtx({
                ...ctx,
                ownership: input.ownership,
                vehicle: {
                  brand: input.brand,
                  model: input.model,
                  year: input.year,
                  category: input.category,
                  rentCents:
                    input.ownership === "rented" ? input.rentCents : null,
                  rentPeriod:
                    input.ownership === "rented" && input.rentCents != null
                      ? input.rentPeriod
                      : null,
                  installmentCents:
                    input.ownership === "financed"
                      ? input.installmentCents
                      : null,
                  insuranceYearCents: input.insuranceYearCents,
                  ipvaYearCents: input.ipvaYearCents,
                  maintenanceCentsPerKm: input.maintenanceCentsPerKm,
                  tiresCentsPerKm: input.tiresCentsPerKm,
                },
              });
              setEditing(false);
            }
            return r;
          }}
        />
      ) : null}
    </Screen>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex h-11 items-center justify-between border-divider not-first:border-t">
      <span
        className={
          strong ? "text-[15px] font-bold" : "text-sm font-semibold text-muted"
        }
      >
        {label}
      </span>
      <span
        className={
          strong ? "text-[16px] font-extrabold" : "text-[15px] font-bold"
        }
      >
        {value}
      </span>
    </div>
  );
}
