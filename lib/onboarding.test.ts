import { describe, expect, it } from "vitest";
import {
  chosenApps,
  daysPerMonthFromWeek,
  nextStep,
  previousStep,
  stepPosition,
  toPayload,
  visibleSteps,
  type OnboardingAnswers,
} from "./onboarding";
import { onboardingAnswersSchema } from "./schemas/onboarding";

describe("visibleSteps adapts to the car answer", () => {
  it.each<[OnboardingAnswers["ownership"], string[]]>([
    [undefined, ["apps", "vehicle", "fuel", "goal", "routine"]],
    ["own", ["apps", "vehicle", "fuel", "goal", "routine"]],
    ["rented", ["apps", "vehicle", "rent", "fuel", "goal", "routine"]],
    ["financed", ["apps", "vehicle", "installment", "fuel", "goal", "routine"]],
  ])("ownership %s", (ownership, steps) => {
    expect(visibleSteps({ ownership })).toEqual(steps);
  });
});

describe("navigation", () => {
  it("walks forward and back through the visible steps", () => {
    const a: OnboardingAnswers = { ownership: "rented" };
    expect(nextStep("vehicle", a)).toBe("rent");
    expect(nextStep("rent", a)).toBe("fuel");
    expect(previousStep("fuel", a)).toBe("rent");
    expect(previousStep("apps", a)).toBeNull();
    expect(nextStep("routine", a)).toBeNull();
  });
  it("skips the extra step for own cars", () => {
    expect(nextStep("vehicle", { ownership: "own" })).toBe("fuel");
    expect(previousStep("fuel", { ownership: "financed" })).toBe("installment");
  });
  it("recovers from a step that became hidden", () => {
    // User answered "rented", reached "rent", went back and chose "own".
    expect(nextStep("rent", { ownership: "own" })).toBe("apps");
    expect(previousStep("rent", { ownership: "own" })).toBeNull();
  });
  it("reports position", () => {
    expect(stepPosition("apps", {})).toEqual({ index: 1, total: 5 });
    expect(stepPosition("installment", { ownership: "financed" })).toEqual({
      index: 3,
      total: 6,
    });
  });
});

describe("chosenApps", () => {
  it("normalizes names and removes duplicates", () => {
    expect(
      chosenApps({
        uber: true,
        n99: false,
        others: [" inDrive ", "indrive", "", "  ", "Lady  Driver"],
      }),
    ).toEqual([
      { source: "uber", label: null },
      { source: "other", label: "inDrive" },
      { source: "other", label: "Lady Driver" },
    ]);
  });
  it("treats typed Uber/99 as the built-in apps", () => {
    expect(
      chosenApps({ uber: false, n99: false, others: ["99", "UBER"] }),
    ).toEqual([
      { source: "99", label: null },
      { source: "uber", label: null },
    ]);
    expect(chosenApps({ uber: true, n99: false, others: ["uber"] })).toEqual([
      { source: "uber", label: null },
    ]);
  });
  it("handles no answer", () => {
    expect(chosenApps(undefined)).toEqual([]);
  });
});

describe("daysPerMonthFromWeek", () => {
  it.each([
    [7, 30],
    [6, 26],
    [5, 22],
    [1, 4],
  ])("%i days/week → %i days/month", (dpw, dpm) => {
    expect(daysPerMonthFromWeek(dpw)).toBe(dpm);
  });
});

describe("toPayload", () => {
  it("maps a full answer set", () => {
    expect(
      toPayload({
        apps: { uber: true, n99: true, others: ["inDrive"] },
        ownership: "rented",
        rent: { cents: 70000, period: "week" },
        installmentCents: 99900, // ignored: not financed
        fuel: "flex",
        goalCents: 800000,
        daysPerWeek: 6,
        hoursPerDay: 510,
      }),
    ).toEqual({
      profile: {
        apps: ["uber", "99", "inDrive"],
        vehicle_ownership: "rented",
        fuel_type: "flex",
        monthly_goal_cents: 800000,
        typical_days_per_month: 26,
        typical_hours_per_day: 8.5,
      },
      vehicle: {
        rent_cents: 70000,
        rent_period: "week",
        installment_cents: null,
      },
      platforms: [
        { source: "uber", label: null },
        { source: "99", label: null },
        { source: "other", label: "inDrive" },
      ],
    });
  });

  it("maps financed cars to the installment only", () => {
    const p = toPayload({
      ownership: "financed",
      installmentCents: 125000,
      rent: { cents: 1, period: "day" },
    });
    expect(p.vehicle).toEqual({
      rent_cents: null,
      rent_period: null,
      installment_cents: 125000,
    });
  });

  it("skipping everything gives nulls and no vehicle row", () => {
    expect(toPayload({})).toEqual({
      profile: {
        apps: [],
        vehicle_ownership: null,
        fuel_type: null,
        monthly_goal_cents: null,
        typical_days_per_month: null,
        typical_hours_per_day: null,
      },
      vehicle: null,
      platforms: [],
    });
  });

  it("own car without extra data has no vehicle row", () => {
    expect(toPayload({ ownership: "own" }).vehicle).toBeNull();
    expect(toPayload({ ownership: "rented" }).vehicle).toBeNull();
  });
});

describe("onboardingAnswersSchema", () => {
  it("accepts valid answers and empty answers", () => {
    expect(onboardingAnswersSchema.safeParse({}).success).toBe(true);
    expect(
      onboardingAnswersSchema.safeParse({
        apps: { uber: true, n99: false, others: [] },
        ownership: "own",
        fuel: "gnv",
        goalCents: 600000,
        daysPerWeek: 5,
        hoursPerDay: 480,
      }).success,
    ).toBe(true);
  });
  it.each([
    { goalCents: -1 },
    { goalCents: 10.5 },
    { daysPerWeek: 8 },
    { hoursPerDay: 1500 },
    { ownership: "leased" },
    { fuel: "diesel" },
    { extra: true },
    { apps: { uber: true, n99: false, others: ["x".repeat(41)] } },
  ])("rejects %j", (bad) => {
    expect(onboardingAnswersSchema.safeParse(bad).success).toBe(false);
  });
});
