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
  goal: TodayGoal | null;
  monthGoalCents: number | null;
  /** Saves today's goal set by hand (null = back to the automatic one). */
  onChange: (cents: number | null) => void;
};

const brl = (c: number) => formatBRL(c, { cents: false });

/** "Meta de hoje" on Registrar, with "Ajustar" to set it by hand for today. */
export function TodayGoalCard({ goal, monthGoalCents, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const edit = (
    <Button
      variant="ghost"
      className="-mr-2 h-touch px-2 text-[14px] underline underline-offset-4"
      onClick={() => setEditing(true)}
    >
      {goal ? "Ajustar" : "Definir"}
    </Button>
  );
  const sheet = editing ? (
    <TodayGoalSheet
      goal={goal}
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
      <Card className="flex items-center justify-between px-4 py-1.5">
        <span className="text-[14px] font-bold text-muted">
          Quer uma meta para hoje?
        </span>
        {edit}
        {sheet}
      </Card>
    );

  if (goal.monthReached)
    return (
      <HeroCard
        as="div"
        radius="hero-md"
        className="flex items-center justify-between gap-3 px-4.5 py-3.5"
      >
        <div>
          <CapsLabel onLime>Meta do mês batida</CapsLabel>
          <p className="mt-1 text-[15px] font-bold">
            O que entrar hoje é extra no bolso.
          </p>
        </div>
        {edit}
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
        <div className="flex flex-col items-end">
          <p className="pt-0.5 text-right text-[14px] font-bold">
            {goal.reachedToday
              ? goal.todayNetCents > goal.targetCents
                ? `Batida! +${brl(goal.todayNetCents - goal.targetCents)}`
                : "Batida!"
              : `Faltam ${brl(goal.missingCents)}`}
          </p>
        </div>
      </div>
      <ProgressBar
        onLime
        className="mt-2.5"
        ratio={goal.ratio}
        label={`${Math.round(goal.ratio * 100)}% da meta de hoje`}
      />
      <div className="mt-0.5 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-lime-text">
          {goal.custom
            ? "Meta que você escolheu para hoje."
            : "Para manter a meta do mês em dia."}
        </p>
        {edit}
      </div>
      {sheet}
    </HeroCard>
  );
}

function TodayGoalSheet({
  goal,
  monthGoalCents,
  onClose,
  onSave,
}: {
  goal: TodayGoal | null;
  monthGoalCents: number | null;
  onClose: () => void;
  onSave: (cents: number | null) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(
    goal && goal.targetCents > 0
      ? toInputBRL(Math.round(goal.targetCents / 100) * 100).replace(/,00$/, "")
      : "",
  );
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
        {error ? (
          <p role="alert" className="text-[14px] font-bold">
            {error}
          </p>
        ) : null}
        <p className="text-[13px] font-semibold text-muted">
          {monthGoalCents
            ? `Sem ajuste, a meta de hoje vem da sua meta do mês (${brl(monthGoalCents)}). O ajuste vale só para hoje.`
            : "Vale só para hoje. Com uma meta do mês, o Km+ calcula a meta de cada dia sozinho."}
        </p>
        <Button type="submit" block>
          Salvar meta de hoje
        </Button>
        {goal?.custom && monthGoalCents ? (
          <Button variant="secondary" block onClick={() => onSave(null)}>
            Voltar para a meta automática
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
