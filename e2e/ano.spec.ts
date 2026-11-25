import { expect, test } from "./support/fixtures";
import { today } from "../lib/dates";
import {
  resetAccount,
  seedDays,
  signIn,
  type TestUser,
} from "./support/supabase";

let user: TestUser;

test.beforeEach(async ({ account }) => {
  user = await resetAccount(account, { apps: ["uber", "99"] });
});

test("year summary: totals, best month and each app", async ({ page }) => {
  const year = today().slice(0, 4);
  await seedDays(user, [
    {
      date: `${year}-01-15`,
      km: 200,
      minutes: 600,
      earnings: [
        { source: "uber", amount_cents: 30000 },
        { source: "99", amount_cents: 10000 },
      ],
      expenses: [{ category: "fuel", amount_cents: 8000 }],
    },
    {
      date: `${year}-03-10`,
      km: 100,
      minutes: 300,
      earnings: [{ source: "uber", amount_cents: 60000 }],
    },
  ]);
  await signIn(page, user, "/painel");
  await page.getByRole("link", { name: `Resumo do ano ${year}` }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Resumo do ano" }),
  ).toBeVisible();
  await expect(page.getByText(`Sobrou no bolso em ${year}`)).toBeVisible();
  // 300 + 100 + 600 = 1.000 earned; 80 of fuel → 920 left.
  const sums = page.getByRole("region", { name: "Contas do ano" });
  await expect(sums).toContainText("Ganhos do anoR$ 1.000,00");
  await expect(sums).toContainText("Gastos− R$ 80,00");
  await expect(sums).toContainText("Sobrou no bolsoR$ 920,00");
  await expect(sums).toContainText("Média por dia rodadoR$ 460,00");
  await expect(page.getByText("Melhor mês: março, com R$ 600")).toBeVisible();
  const apps = page.getByRole("region", { name: "Ganhos por app" });
  await expect(apps).toContainText("UberR$ 900 · 90%");
  await expect(apps).toContainText("99R$ 100 · 10%");
  await expect(page.getByText("Não é aconselhamento tributário")).toBeVisible();

  // Previous year: friendly empty state.
  await page.getByRole("button", { name: "Ano anterior" }).click();
  await expect(
    page.getByRole("heading", {
      name: `Nenhum dia registrado em ${Number(year) - 1}`,
    }),
  ).toBeVisible();
});
