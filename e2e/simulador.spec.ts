import { expect, test } from "./support/fixtures";
import { addDays, today } from "../lib/dates";
import {
  seedDays,
  setProfile,
  resetAccount,
  signIn,
  type TestUser,
} from "./support/supabase";

let user: TestUser;
test.beforeEach(async ({ account }) => {
  user = await resetAccount(account, { apps: ["uber"] });
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
  // 1 · pace, 2 · routine (with what it leaves per month), 3 · goal.
  await expect(page.getByText("R$ 31,25 por hora")).toBeVisible();
  await expect(
    page.getByText(
      "Nesse ritmo e nessa rotina, sobram cerca de R$ 6.000 por mês.",
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Quanto você quer que sobre por mês"),
  ).toHaveValue("10.000");
  await expect(
    page.getByText("R$ 4.000 a mais do que sobra hoje."),
  ).toBeVisible();
  await expect(page.getByLabel("Horas por dia")).toHaveValue("8");
  await expect(page.getByLabel("Dias por mês")).toHaveValue("24");

  const hero = page.locator("section").filter({
    has: page.getByRole("heading", { name: "O que precisa" }),
  });
  await expect(hero).toContainText(
    "Para sobrar R$ 10.000 por mês, cada hora precisa deixar",
  );
  await expect(hero).toContainText("R$ 52,08");
  await expect(hero).toContainText("67% a mais que hoje · R$ 416,67 por dia");

  const paths = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Ou mude a rotina" }),
  });
  await expect(paths.getByRole("listitem").nth(0)).toContainText(
    "Rodar mais horas",
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
    "uma meta intermediária de R$ 8.000 por mês pede 10h40 por dia",
  );
  await expect(
    page.getByText(
      "Estimativa baseada no seu histórico, não é garantia de ganho.",
    ),
  ).toBeVisible();

  // A gentler goal: no high-load note.
  await page.getByLabel("Quanto você quer que sobre por mês").fill("7.000");
  await expect(hero).toContainText("R$ 291,67 por dia");
  await expect(paths).not.toContainText("carga alta");

  // A goal the current routine already reaches.
  await page.getByLabel("Quanto você quer que sobre por mês").fill("5.000");
  await expect(hero).toContainText(
    "Mantendo o seu ritmo e essa rotina, você chega à meta.",
  );
  await expect(paths).toHaveCount(0);
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
  await page.getByLabel("Quanto você quer que sobre por mês").fill("9000");
  await expect(
    page.getByRole("heading", { name: "Ou mude a rotina" }),
  ).toBeVisible();
});

test("without history shows only what to earn per day and per hour", async ({
  page,
}) => {
  await signIn(page, user, "/simulador");
  await expect(
    page.getByText("Ainda sem dias com horas registradas"),
  ).toBeVisible();
  await page.getByLabel("Quanto você quer que sobre por mês").fill("6.600");
  await page.getByLabel("Dias por mês").fill("22");
  await page.getByLabel("Horas por dia").fill("10");
  const hero = page.locator("section").filter({
    has: page.getByRole("heading", { name: "O que precisa" }),
  });
  await expect(hero).toContainText("R$ 30,00");
  await expect(hero).toContainText("R$ 300,00 por dia");
  await expect(page.getByText("para ver os caminhos até a meta")).toBeVisible();
});
