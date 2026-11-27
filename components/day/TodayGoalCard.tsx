"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CapsLabel, Card, HeroCard } from "@/components/ui/Card";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Sheet } from "@/components/ui/Sheet";
import type { TodayGoal } from "@/lib/metrics/period";
import { formatBRL, parseBRL, toInputBRL } from "@/lib/money";

type Props = {
  /** Today's goal, set by the driver (null = not set yet today). */
  goal: TodayGoal | null;
  /** What keeps the month goal on track (offered as a suggestion). */
  suggestionCents: number | null;
  monthGoalCents: number | null;
  /** Saves today's goal (null removes it). */
  onChange: (cents: number | null) => void;
};

const brl = (c: number) => formatBRL(c, { cents: false });
const wholeReais = (c: number) =>
  toInputBRL(Math.round(c / 100) * 100).replace(/,00$/, "");

/** Flag on the road: "no goal yet" illustration (stroke, ink on lime). */
function GoalIllustration() {
  return (
    <svg
      aria-hidden="true"
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M6 48c8-3 14-3 22 0s14 3 22 0" />
      <path d="M20 46V10" />
      <path d="M20 11h20l-5 7 5 7H20" fill="rgba(16,24,40,.12)" />
      <circle cx="20" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * "Meta de hoje" on Registrar. It starts empty every day: the driver chooses
 * it (the month goal only suggests a value).
 */
export function TodayGoalCard({
  goal,
  suggestionCents,
  monthGoalCents,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const sheet = editing ? (
    <TodayGoalSheet
      goal={goal}
      suggestionCents={suggestionCents}
      monthGoalCents={monthGoalCents}
      onClose={() => setEditing(false)}
      onSave={(v) => {
        onChange(v);
        setEditing(false);
      }}
    />
  ) : null;

  if (!goal)
    return (
      <HeroCard
        as="div"
        radius="hero-md"
        className="flex flex-col gap-3 px-4.5 pt-4 pb-4"
        aria-label="Meta de hoje"
      >
        <div className="flex items-center gap-3.5">
          <GoalIllustration />
          <div>
            <CapsLabel onLime>Meta de hoje</CapsLabel>
            <p className="mt-0.5 text-[16px] leading-snug font-extrabold">
              Você ainda não definiu uma meta para hoje
            </p>
          </div>
        </div>
        <Button block className="h-12" onClick={() => setEditing(true)}>
          Definir meta de hoje
        </Button>
        {sheet}
      </HeroCard>
    );

  return (
    <HeroCard
      as="div"
      radius="hero-md"
      className="px-4.5 pt-3.5 pb-2"
      aria-label="Meta de hoje"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <CapsLabel onLime>Meta de hoje</CapsLabel>
          <div className="mt-0.5 font-display text-[24px] leading-none font-extrabold tracking-hero">
            {brl(goal.targetCents)}
          </div>
        </div>
        <p className="pt-0.5 text-right text-[14px] font-bold">
          {goal.reachedToday
            ? goal.todayNetCents > goal.targetCents
              ? `Batida! +${brl(goal.todayNetCents - goal.targetCents)}`
              : "Batida!"
            : `Faltam ${brl(goal.missingCents)}`}
        </p>
      </div>
      <ProgressBar
        onLime
        className="mt-2.5"
        ratio={goal.ratio}
        label={`${Math.round(goal.ratio * 100)}% da meta de hoje`}
      />
      <div className="mt-0.5 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-lime-text">
          Vale só para hoje.
        </p>
        <Button
          variant="ghost"
          className="-mr-2 h-touch px-2 text-[14px] underline underline-offset-4"
          onClick={() => setEditing(true)}
        >
          Ajustar
        </Button>
      </div>
      {sheet}
    </HeroCard>
  );
}

function TodayGoalSheet({
  goal,
  suggestionCents,
  monthGoalCents,
  onClose,
  onSave,
}: {
  goal: TodayGoal | null;
  suggestionCents: number | null;
  monthGoalCents: number | null;
  onClose: () => void;
  onSave: (cents: number | null) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(goal ? wholeReais(goal.targetCents) : "");
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet open onClose={onClose} title="Meta de hoje">
      <form
        className="flex flex-col gap-gap-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const cents = parseBRL(value);
          if (cents == null || cents <= 0)
            return setError("Informe um valor. Exemplo: 300");
          onSave(cents);
        }}
      >
        <Card className="px-4 py-3">
          <label htmlFor={id} className="block label-caps text-muted">
            Quanto você quer que sobre hoje
          </label>
          <MoneyInput
            id={id}
            value={value}
            onChange={(v) => {
              setValue(v);
              setError(null);
            }}
            placeholder="0,00"
            autoFocus
          />
        </Card>
        {suggestionCents && suggestionCents > 0 ? (
          <button
            type="button"
            onClick={() => {
              setValue(wholeReais(suggestionCents));
              setError(null);
            }}
            className="flex min-h-touch items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-2 text-left"
          >
            <span className="text-[13px] font-semibold text-muted">
              Sugestão para manter a meta do mês
              {monthGoalCents ? ` (${brl(monthGoalCents)})` : ""} em dia
            </span>
            <span className="text-[16px] font-extrabold whitespace-nowrap">
              {brl(suggestionCents)}
            </span>
          </button>
        ) : null}
        {error ? (
          <p role="alert" className="text-[14px] font-bold">
            {error}
          </p>
        ) : null}
        <p className="text-[13px] font-semibold text-muted">
          A meta vale só para hoje. Amanhã o cartão começa vazio de novo.
        </p>
        <Button type="submit" block>
          Salvar meta de hoje
        </Button>
        {goal ? (
          <Button variant="secondary" block onClick={() => onSave(null)}>
            Tirar a meta de hoje
          </Button>
        ) : null}
        <Link
          href="/ajustes"
          className="flex h-touch items-center justify-center text-[14px] font-extrabold underline underline-offset-4"
        >
          {monthGoalCents ? "Mudar a meta do mês" : "Definir uma meta do mês"}
        </Link>
      </form>
    </Sheet>
  );
}
