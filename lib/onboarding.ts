/**
 * Adaptive onboarding: one question per screen, every question skippable.
 * The step list depends on the answers (rented → rent, financed → installment).
 * Pure functions only; the UI and the server action share them.
 */
import type { Cents } from "./money";
import type { Minutes } from "./units";

export type Ownership = "own" | "rented" | "financed";
export type FuelType = "gasoline" | "ethanol" | "flex" | "gnv" | "electric";
export type Period = "day" | "week" | "month";

export type OnboardingAnswers = {
  apps?: { uber: boolean; n99: boolean; others: string[] };
  ownership?: Ownership;
  rent?: { cents: Cents; period: Period };
  installmentCents?: Cents;
  fuel?: FuelType;
  goalCents?: Cents;
  daysPerWeek?: number;
  hoursPerDay?: Minutes;
};

export type StepId =
  "apps" | "vehicle" | "rent" | "installment" | "fuel" | "goal" | "routine";

const ALL_STEPS: readonly StepId[] = [
  "apps",
  "vehicle",
  "rent",
  "installment",
  "fuel",
  "goal",
  "routine",
];

export function visibleSteps(answers: OnboardingAnswers): StepId[] {
  return ALL_STEPS.filter((step) => {
    if (step === "rent") return answers.ownership === "rented";
    if (step === "installment") return answers.ownership === "financed";
    return true;
  });
}

/** Next step, or null when the flow is done. */
export function nextStep(
  current: StepId,
  answers: OnboardingAnswers,
): StepId | null {
  const steps = visibleSteps(answers);
  const i = steps.indexOf(current);
  if (i === -1) return steps[0] ?? null;
  return steps[i + 1] ?? null;
}

/** Previous step, or null on the first one. */
export function previousStep(
  current: StepId,
  answers: OnboardingAnswers,
): StepId | null {
  const steps = visibleSteps(answers);
  const i = steps.indexOf(current);
  if (i <= 0) return null;
  return steps[i - 1]!;
}

export function stepPosition(current: StepId, answers: OnboardingAnswers) {
  const steps = visibleSteps(answers);
  return {
    index: Math.max(0, steps.indexOf(current)) + 1,
    total: steps.length,
  };
}

/** Average weeks per month (52 / 12). */
const WEEKS_PER_MONTH = 52 / 12;

export function daysPerMonthFromWeek(daysPerWeek: number): number {
  return Math.min(31, Math.round(daysPerWeek * WEEKS_PER_MONTH));
}

export type AppEntry = {
  source: "uber" | "99" | "other";
  label: string | null;
};

/** Normalizes the chosen apps (trims names, drops blanks and duplicates). */
export function chosenApps(apps: OnboardingAnswers["apps"]): AppEntry[] {
  if (!apps) return [];
  const out: AppEntry[] = [];
  if (apps.uber) out.push({ source: "uber", label: null });
  if (apps.n99) out.push({ source: "99", label: null });
  const seen = new Set<string>();
  for (const raw of apps.others) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    const key = name.toLocaleLowerCase("pt-BR");
    if (!name || seen.has(key)) continue;
    // A free-text "Uber"/"99" is the same as ticking the box.
    if (key === "uber" || key === "99") {
      if (!out.some((a) => a.source === key))
        out.push({ source: key, label: null });
      continue;
    }
    seen.add(key);
    out.push({ source: "other", label: name });
  }
  return out;
}

export type OnboardingPayload = {
  profile: {
    apps: string[];
    vehicle_ownership: Ownership | null;
    fuel_type: FuelType | null;
    monthly_goal_cents: Cents | null;
    typical_days_per_month: number | null;
    typical_hours_per_day: number | null;
  };
  /** Only when there is something to store about the car. */
  vehicle: {
    rent_cents: Cents | null;
    rent_period: Period | null;
    installment_cents: Cents | null;
  } | null;
  platforms: AppEntry[];
};

/** Maps answers to database rows. Skipped questions become null. */
export function toPayload(answers: OnboardingAnswers): OnboardingPayload {
  const apps = chosenApps(answers.apps);
  const ownership = answers.ownership ?? null;
  const rent = ownership === "rented" ? (answers.rent ?? null) : null;
  const installment =
    ownership === "financed" ? (answers.installmentCents ?? null) : null;

  return {
    profile: {
      apps: apps.map((a) => (a.source === "other" ? a.label! : a.source)),
      vehicle_ownership: ownership,
      fuel_type: answers.fuel ?? null,
      monthly_goal_cents: answers.goalCents ?? null,
      typical_days_per_month:
        answers.daysPerWeek != null
          ? daysPerMonthFromWeek(answers.daysPerWeek)
          : null,
      typical_hours_per_day:
        answers.hoursPerDay != null
          ? Math.round((answers.hoursPerDay / 60) * 100) / 100
          : null,
    },
    vehicle:
      rent || installment != null
        ? {
            rent_cents: rent?.cents ?? null,
            rent_period: rent?.period ?? null,
            installment_cents: installment,
          }
        : null,
    platforms: apps,
  };
}
