import AxeBuilder from "@axe-core/playwright";
import { test as plain, type Page } from "@playwright/test";
import { addDays, today } from "../lib/dates";
import { expect, test } from "./support/fixtures";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  resetAccount,
  seedDays,
  setProfile,
  setVehicle,
  signIn,
  type TestUser,
} from "./support/supabase";

/** WCAG 2.1 AA (and best practices) on every screen, with data on screen. */
async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  const serious = result.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const summary = serious.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(" | ")}`,
  );
  expect(summary).toEqual([]);
}

test.describe("signed in, with data", () => {
  let user: TestUser;
  test.beforeEach(async ({ account }) => {
    user = await resetAccount(account, { apps: ["uber", "99"] });
    await setProfile(user, {
      monthly_goal_cents: 800000,
      typical_hours_per_day: 8,
      typical_days_per_month: 24,
      vehicle_mode_enabled: true,
      vehicle_ownership: "own",
    });
    await setVehicle(user, {
      maintenance_cents_per_km: 20,
      tires_cents_per_km: 5,
    });
    await seedDays(
      user,
      Array.from({ length: 10 }, (_, i) => ({
        date: addDays(today(), -i),
        minutes: 480,
        km: 140,
        earnings: [
          { source: "uber" as const, amount_cents: 20000, minutes: 300 },
          { source: "99" as const, amount_cents: 9000, minutes: 180 },
        ],
        expenses: [{ category: "fuel" as const, amount_cents: 8000 }],
      })),
    );
  });

  for (const [path, ready] of [
    ["/registrar", "Como foi o dia?"],
    ["/painel", "Painel"],
    ["/painel/lucro", "Lucro líquido"],
    ["/simulador", "Simulador de meta"],
    ["/insights", "Insights"],
    ["/ajustes", "Ajustes"],
  ] as const) {
    test(`${path} has no serious accessibility issues`, async ({ page }) => {
      await signIn(page, user, path);
      await expect(
        page.getByRole("heading", { level: 1, name: ready }),
      ).toBeVisible();
      await page.waitForTimeout(300);
      await audit(page);
    });
  }

  test("open sheets and expanded options too", async ({ page }) => {
    await signIn(page, user, "/registrar");
    await page.getByRole("button", { name: "Mais opções" }).click();
    await audit(page);
    await page.getByRole("button", { name: "+ Pedágio" }).click();
    await expect(page.getByRole("dialog", { name: "Pedágio" })).toBeVisible();
    await audit(page);
  });
});

plain.describe("public and pre-purchase screens", () => {
  let user: TestUser;
  plain.afterEach(async () => {
    await deleteTestUser(user).catch(() => undefined);
  });

  plain("login, onboarding, purchase and legal pages", async ({ page }) => {
    await page.goto("/entrar");
    await audit(page);
    await page.goto("/termos");
    await audit(page);
    await page.goto("/privacidade");
    await audit(page);

    user = await createTestUser();
    await signIn(page, user);
    await plain.expect(page).toHaveURL(/\/onboarding$/);
    await audit(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    await audit(page); // ChoiceList step

    const db = await adminClient();
    await db
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", user.id);
    await page.goto("/comprar");
    await audit(page);
  });
});
