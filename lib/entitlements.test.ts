import { describe, expect, it } from "vitest";
import { activePlan, can, type Feature, type Plan } from "./entitlements";

describe("can", () => {
  it.each<[Plan | null, Feature, boolean]>([
    ["premium", "app", true],
    ["premium", "account", true],
    ["premium", "purchase", false],
    ["free", "app", false],
    ["free", "account", true],
    ["free", "purchase", true],
    [null, "app", false],
    [null, "account", true],
    [null, "purchase", true],
  ])("%s · %s → %s", (plan, feature, expected) => {
    expect(can({ id: "u", plan }, feature)).toBe(expected);
  });
  it("denies everything when signed out", () => {
    expect(can(null, "account")).toBe(false);
    expect(can(null, "purchase")).toBe(false);
  });
});

describe("activePlan", () => {
  it("ignores revoked rows and prefers premium", () => {
    expect(activePlan([])).toBeNull();
    expect(
      activePlan([{ plan: "premium", revoked_at: "2026-11-01" }]),
    ).toBeNull();
    expect(activePlan([{ plan: "free", revoked_at: null }])).toBe("free");
    expect(
      activePlan([
        { plan: "free", revoked_at: null },
        { plan: "premium", revoked_at: null },
      ]),
    ).toBe("premium");
  });
});
