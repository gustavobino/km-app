import { expect, test } from "@playwright/test";
import { addDays, today } from "../lib/dates";
import {
  createTestUser,
  deleteTestUser,
  seedDays,
  setProfile,
  signIn,
  type TestUser,
} from "./support/supabase";

let user: TestUser;
test.beforeEach(async () => {
  user = await createTestUser({ onboarded: true, apps: ["uber"] });
});
test.afterEach(async () => {
  await deleteTestUser(user);
});

test("CLAUDE.md example: 6.000 in 192 h, goal 10.000 with 8 h × 24 days", async ({
  page,
}) => {
  await seedDays(
    user,
    Array.from({ length: 24 }, (_, i) => ({
      date: addDays(today(), -(i + 1)),
      minutes: 480,
      earnings: [{ source: "uber" as const, amount_cents: 25000 }],
    })),
  );
  await setProfile(user, {
    monthly_goal_cents: 1000000,
    typical_hours_per_day: 8,
    typical_days_per_month: 24,
  });
  await signIn(page, user, "/simulador");

  await expect(
    page.getByText("Calculado com o seu histórico dos últimos 3 meses"),
  ).toBeVisible();
  await expect(page.getByText("R$ 6.000", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 31,25 por hora")).toBeVisible();
  await expect(page.getByLabel("Quero chegar a")).toHaveValue("10.000");
  await expect(page.getByLabel("Horas por dia")).toHaveValue("8");
  await expect(page.getByLabel("Dias por mês")).toHaveValue("24");

  const hero = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Para chegar lá, sobrar por dia",
    }),
  });
  await expect(hero).toContainText("R$ 416,67");
  await expect(hero).toContainText(
    "R$ 52,08 por hora · 67% acima do seu ritmo",
  );

  const paths = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Caminhos para chegar lá" }),
  });
  await expect(paths.getByRole("listitem").nth(0)).toContainText(
    "Só mais horas",
  );
  await expect(paths.getByRole("listitem").nth(0)).toContainText(
    "carga alta: dá para fazer melhor",
  );
  await expect(paths.getByRole("listitem").nth(0)).toContainText(
    "13h20 por dia",
  );
  await expect(paths.getByRole("listitem").nth(1)).toContainText(
    "11h07 por dia",
  );
  await expect(paths.getByRole("listitem").nth(2)).toContainText(
    "10h15 por dia",
  );
  await expect(paths).toContainText(
    "no meio do caminho, R$ 8.000 por mês pedem 10h40 por dia",
  );
  await expect(
    page.getByText(
      "Estimativa baseada no seu histórico, não é garantia de ganho.",
    ),
  ).toBeVisible();

  // A gentler goal: no high-load note.
  await page.getByLabel("Quero chegar a").fill("7.000");
  await expect(hero).toContainText("R$ 291,67");
  await expect(paths).not.toContainText("carga alta");
});

test("little history is flagged and no history hides the paths", async ({
  page,
}) => {
  await seedDays(user, [
    {
      date: addDays(today(), -1),
      minutes: 480,
      earnings: [{ source: "uber", amount_cents: 25000 }],
    },
  ]);
  await signIn(page, user, "/simulador");
  await expect(
    page.getByText("Ainda com pouco histórico: 1 dia com horas."),
  ).toBeVisible();
  await page.getByLabel("Quero chegar a").fill("5000");
  await expect(
    page.getByRole("heading", { name: "Caminhos para chegar lá" }),
  ).toBeVisible();
});

test("without history shows only what to earn per day and per hour", async ({
  page,
}) => {
  await signIn(page, user, "/simulador");
  await expect(
    page.getByText("Ainda sem dias com horas registradas"),
  ).toBeVisible();
  await page.getByLabel("Quero chegar a").fill("6.600");
  await page.getByLabel("Dias por mês").fill("22");
  await page.getByLabel("Horas por dia").fill("10");
  const hero = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Para chegar lá, sobrar por dia",
    }),
  });
  await expect(hero).toContainText("R$ 300,00");
  await expect(hero).toContainText("R$ 30,00 por hora");
  await expect(
    page.getByText("Registre alguns dias com as horas rodadas"),
  ).toBeVisible();
});
