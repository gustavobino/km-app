"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CapsLabel } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ChoiceList } from "@/components/ui/ChoiceList";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Segmented } from "@/components/ui/Segmented";
import { ErrorState } from "@/components/ui/States";
import { Stepper } from "@/components/ui/Stepper";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { parseBRL } from "@/lib/money";
import {
  nextStep,
  previousStep,
  stepPosition,
  type FuelType,
  type OnboardingAnswers,
  type Ownership,
  type Period,
  type StepId,
} from "@/lib/onboarding";
import { parseHours } from "@/lib/units";
import { saveOnboarding } from "./actions";

const COPY: Record<StepId, { title: string; hint?: string }> = {
  apps: { title: "Em quais apps você roda?", hint: "Pode marcar mais de um." },
  vehicle: { title: "Seu carro é…" },
  rent: {
    title: "Quanto você paga de aluguel?",
    hint: "Entra na Reserva do carro, se você ligar o modo veículo.",
  },
  installment: {
    title: "Qual o valor da parcela?",
    hint: "Por mês. Entra na Reserva do carro, se você ligar o modo veículo.",
  },
  fuel: { title: "Qual combustível você usa?" },
  goal: {
    title: "Quanto você quer que sobre no bolso por mês?",
    hint: "É a sua meta. Dá para mudar quando quiser.",
  },
  routine: {
    title: "Como é a sua rotina?",
    hint: "Uma média já ajuda. Usamos no simulador até você ter histórico.",
  },
};

const OWNERSHIP_CHOICES = [
  { value: "own", label: "Próprio" },
  { value: "rented", label: "Alugado", hint: "Pergunto o valor do aluguel" },
  {
    value: "financed",
    label: "Financiado",
    hint: "Pergunto o valor da parcela",
  },
] as const satisfies readonly {
  value: Ownership;
  label: string;
  hint?: string;
}[];

const FUEL_CHOICES = [
  { value: "flex", label: "Flex" },
  { value: "gasoline", label: "Gasolina" },
  { value: "ethanol", label: "Etanol" },
  { value: "gnv", label: "GNV" },
  { value: "electric", label: "Elétrico" },
] as const satisfies readonly { value: FuelType; label: string }[];

const PERIOD_OPTIONS = [
  { value: "day", label: "Por dia" },
  { value: "week", label: "Por semana" },
  { value: "month", label: "Por mês" },
] as const satisfies readonly { value: Period; label: string }[];

export function OnboardingFlow() {
  const [step, setStep] = useState<StepId>("apps");
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Raw input state (kept separate so the driver can go back and edit).
  const [uber, setUber] = useState(false);
  const [n99, setN99] = useState(false);
  const [otherOn, setOtherOn] = useState(false);
  const [others, setOthers] = useState<string[]>([""]);
  const [rentText, setRentText] = useState("");
  const [rentPeriod, setRentPeriod] = useState<Period>("week");
  const [installmentText, setInstallmentText] = useState("");
  const [goalText, setGoalText] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(6);
  const [hoursText, setHoursText] = useState("8");

  const ids = {
    rent: useId(),
    installment: useId(),
    goal: useId(),
    hours: useId(),
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const { index, total } = stepPosition(step, answers);
  const prev = previousStep(step, answers);
  const isLast = nextStep(step, answers) === null;

  function advance(updated: OnboardingAnswers) {
    setError(null);
    setAnswers(updated);
    const next = nextStep(step, updated);
    if (next) {
      setStep(next);
      return;
    }
    startTransition(async () => {
      const result = await saveOnboarding(updated);
      if (result && !result.ok) setError(result.error);
    });
  }

  /** Reads the current screen into answers. Returns null (and shows an error) if invalid. */
  function readStep(): OnboardingAnswers | null {
    const a = { ...answers };
    switch (step) {
      case "apps":
        a.apps = { uber, n99, others: otherOn ? others : [] };
        if (!uber && !n99 && !(otherOn && others.some((o) => o.trim())))
          delete a.apps;
        return a;
      case "vehicle":
        return a; // set on tap
      case "rent": {
        if (!rentText.trim()) {
          delete a.rent;
          return a;
        }
        const cents = parseBRL(rentText);
        if (cents == null) return invalid("Confira o valor. Exemplo: 700,00");
        a.rent = { cents, period: rentPeriod };
        return a;
      }
      case "installment": {
        if (!installmentText.trim()) {
          delete a.installmentCents;
          return a;
        }
        const cents = parseBRL(installmentText);
        if (cents == null) return invalid("Confira o valor. Exemplo: 1.250,00");
        a.installmentCents = cents;
        return a;
      }
      case "fuel":
        return a; // set on tap
      case "goal": {
        if (!goalText.trim()) {
          delete a.goalCents;
          return a;
        }
        const cents = parseBRL(goalText);
        if (cents == null) return invalid("Confira o valor. Exemplo: 6.000");
        a.goalCents = cents;
        return a;
      }
      case "routine": {
        const minutes = parseHours(hoursText);
        if (minutes == null || minutes < 30 || minutes > 20 * 60) {
          return invalid("Informe as horas por dia. Exemplo: 8 ou 8,5");
        }
        a.daysPerWeek = daysPerWeek;
        a.hoursPerDay = minutes;
        return a;
      }
    }
  }

  function invalid(message: string): null {
    setError(message);
    return null;
  }

  function onContinue() {
    const updated = readStep();
    if (updated) advance(updated);
  }

  function onSkip() {
    const a = { ...answers };
    if (step === "apps") delete a.apps;
    if (step === "vehicle") delete a.ownership;
    if (step === "rent") delete a.rent;
    if (step === "installment") delete a.installmentCents;
    if (step === "fuel") delete a.fuel;
    if (step === "goal") delete a.goalCents;
    if (step === "routine") {
      delete a.daysPerWeek;
      delete a.hoursPerDay;
    }
    advance(a);
  }

  const copy = COPY[step];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-column flex-col px-5 pt-4 pb-6">
      <div className="flex h-touch items-center justify-between">
        {prev ? (
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => {
              setError(null);
              setStep(prev);
            }}
            className="-ml-2.5 flex size-touch items-center justify-center"
          >
            <ArrowLeftIcon />
          </button>
        ) : (
          <span className="font-display text-[22px] font-extrabold tracking-hero">
            Km+
          </span>
        )}
        <button
          type="button"
          onClick={onSkip}
          disabled={pending}
          className="-mr-2 h-touch px-2 text-[15px] font-bold text-muted"
        >
          {isLast ? "Pular e começar" : "Pular"}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Progresso"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index}
          aria-valuetext={`Pergunta ${index} de ${total}`}
          className="h-1.5 flex-1 rounded-bar bg-segment-bg"
        >
          <div
            className="h-1.5 rounded-bar bg-ink transition-[width]"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
        <span className="text-[13px] font-bold text-muted">
          {index} de {total}
        </span>
      </div>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-8 font-display text-[30px] leading-[1.12] font-extrabold outline-none"
      >
        {copy.title}
      </h1>
      {copy.hint ? (
        <p className="mt-2 text-[15px] font-semibold text-muted">{copy.hint}</p>
      ) : null}

      <div className="mt-6 flex flex-col gap-gap-card">
        {step === "apps" ? (
          <>
            <div
              role="group"
              aria-label="Apps"
              className="flex flex-wrap gap-2"
            >
              <Chip
                selected={uber}
                aria-pressed={uber}
                onClick={() => setUber(!uber)}
              >
                Uber
              </Chip>
              <Chip
                selected={n99}
                aria-pressed={n99}
                onClick={() => setN99(!n99)}
              >
                99
              </Chip>
              <Chip
                selected={otherOn}
                aria-pressed={otherOn}
                onClick={() => setOtherOn(!otherOn)}
              >
                Outro app
              </Chip>
            </div>
            {otherOn ? (
              <Card className="flex flex-col px-4 pt-3 pb-2">
                {others.map((name, i) => (
                  <label
                    key={i}
                    className="flex flex-col border-divider py-1 not-first:border-t"
                  >
                    <span className="label-caps text-muted">
                      Nome do app{others.length > 1 ? ` ${i + 1}` : ""}
                    </span>
                    <input
                      value={name}
                      maxLength={40}
                      placeholder="Ex.: inDrive"
                      onChange={(e) =>
                        setOthers(
                          others.map((o, j) => (j === i ? e.target.value : o)),
                        )
                      }
                      className="h-touch bg-transparent text-[17px] font-bold outline-none placeholder:text-muted/60"
                    />
                  </label>
                ))}
                {others.length < 8 ? (
                  <button
                    type="button"
                    onClick={() => setOthers([...others, ""])}
                    className="h-touch self-start text-[15px] font-extrabold"
                  >
                    + adicionar outro app
                  </button>
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}

        {step === "vehicle" ? (
          <ChoiceList
            legend={copy.title}
            legendHidden
            choices={OWNERSHIP_CHOICES}
            value={answers.ownership}
            onChange={(ownership) => setAnswers({ ...answers, ownership })}
          />
        ) : null}

        {step === "rent" ? (
          <>
            <Card className="px-4 py-3">
              <label htmlFor={ids.rent} className="block label-caps text-muted">
                Valor do aluguel
              </label>
              <MoneyInput
                id={ids.rent}
                value={rentText}
                onChange={setRentText}
                placeholder="0,00"
              />
            </Card>
            <Segmented
              label="Periodicidade"
              options={PERIOD_OPTIONS}
              value={rentPeriod}
              onChange={setRentPeriod}
            />
          </>
        ) : null}

        {step === "installment" ? (
          <Card className="px-4 py-3">
            <label
              htmlFor={ids.installment}
              className="block label-caps text-muted"
            >
              Parcela por mês
            </label>
            <MoneyInput
              id={ids.installment}
              value={installmentText}
              onChange={setInstallmentText}
              placeholder="0,00"
            />
          </Card>
        ) : null}

        {step === "fuel" ? (
          <ChoiceList
            legend={copy.title}
            legendHidden
            choices={FUEL_CHOICES}
            value={answers.fuel}
            onChange={(fuel) => setAnswers({ ...answers, fuel })}
          />
        ) : null}

        {step === "goal" ? (
          <Card className="px-4 py-3">
            <label htmlFor={ids.goal} className="block label-caps text-muted">
              Meta por mês
            </label>
            <MoneyInput
              id={ids.goal}
              value={goalText}
              onChange={setGoalText}
              placeholder="6.000"
              sizeClass="text-[36px]"
            />
          </Card>
        ) : null}

        {step === "routine" ? (
          <>
            <Card className="px-4 py-3">
              <CapsLabel className="mb-2">Dias por semana</CapsLabel>
              <Stepper
                label="Dias por semana"
                value={daysPerWeek}
                onChange={setDaysPerWeek}
                min={1}
                max={7}
                unit="dias"
              />
            </Card>
            <Card className="px-4 py-3">
              <label
                htmlFor={ids.hours}
                className="block label-caps text-muted"
              >
                Horas por dia
              </label>
              <div className="flex items-baseline gap-1.5">
                <input
                  id={ids.hours}
                  inputMode="decimal"
                  value={hoursText}
                  onChange={(e) => setHoursText(e.target.value)}
                  className="w-20 bg-transparent py-1 font-display text-[34px] font-extrabold outline-none"
                />
                <span aria-hidden="true" className="font-bold text-muted">
                  h
                </span>
              </div>
            </Card>
          </>
        ) : null}

        {error ? <ErrorState message={error} /> : null}
      </div>

      <div className="sticky bottom-0 mt-auto bg-bg pt-6 pb-[env(safe-area-inset-bottom)]">
        <Button block onClick={onContinue} disabled={pending}>
          {pending ? "Salvando…" : isLast ? "Começar a usar" : "Continuar"}
        </Button>
      </div>
    </main>
  );
}
