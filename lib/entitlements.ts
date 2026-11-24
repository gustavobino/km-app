/**
 * The ONLY place that decides who can use what (CLAUDE.md › Acesso e pagamento).
 * A future free plan is just a change to the rules below.
 */

export type Plan = "premium" | "free";

export type AccessUser = {
  id: string;
  /** Active plan, or null without any entitlement. */
  plan: Plan | null;
};

export type Feature =
  /** Register days, Painel, Lucro, Simulador, Insights. */
  | "app"
  /** Settings, export my data, delete my account (always allowed: LGPD). */
  | "account"
  /** The purchase screen. */
  | "purchase";

const RULES: Record<Feature, (plan: Plan | null) => boolean> = {
  app: (plan) => plan === "premium",
  account: () => true,
  purchase: (plan) => plan !== "premium",
};

export function can(user: AccessUser | null, feature: Feature): boolean {
  if (!user) return false;
  return RULES[feature](user.plan);
}

export type EntitlementRow = { plan: Plan; revoked_at: string | null };

/** The best active plan among the user's entitlement rows. */
export function activePlan(rows: readonly EntitlementRow[]): Plan | null {
  const active = rows.filter((r) => r.revoked_at == null);
  if (active.some((r) => r.plan === "premium")) return "premium";
  if (active.some((r) => r.plan === "free")) return "free";
  return null;
}
