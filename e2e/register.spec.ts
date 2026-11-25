import { expect, test } from "./support/fixtures";
import type { Page } from "@playwright/test";
import { addDays, remainingDaysInMonth, today } from "../lib/dates";
import { formatBRL } from "../lib/money";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  grantPremium,
  resetAccount,
  setProfile,
  signIn,
  type TestUser,
} from "./support/supabase";

let user: TestUser;

test.beforeEach(async ({ account }) => {
  user = await resetAccount(account, { apps: ["uber", "99", "inDrive"] });
});

async function serverDay(date: string) {
  const db = await adminClient();
  const { data } = await db
    .from("days")
    .select(
      "id,minutes,km,is_day_off,shifts,earnings(source,label,amount_cents),expenses(category,amount_cents,liters,odometer_km,full_tank)",
    )
    .eq("user_id", user.id)
    .eq("date", date);
  return data ?? [];
}

const hero = (page: Page) =>
  page.locator("[aria-live='polite']").filter({ hasText: "Sobrou no bolso" });

async function fillExampleDay(page: Page) {
  await page.getByLabel("Ganho Uber, em reais").fill("212,50");
  await page.getByLabel("Ganho 99, em reais").fill("98");
  await page.getByLabel("Ganho inDrive, em reais").fill("40,00");
  await page.getByLabel("Horas rodadas").fill("8,5");
  await page.getByLabel("Km rodados").fill("142");
}

async function addExpense(
  page: Page,
  chip: string,
  amount: string,
  extra?: (page: Page) => Promise<void>,
) {
  await page.getByRole("button", { name: `+ ${chip}`, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: chip });
  await sheet.getByLabel("Valor").fill(amount);
  if (extra) await extra(page);
  await sheet.getByRole("button", { name: "Adicionar gasto" }).click();
  await expect(sheet).toBeHidden();
}

test("registers the example day and the live total matches CLAUDE.md", async ({
  page,
}) => {
  await signIn(page, user);
  await expect(
    page.getByRole("heading", { name: "Como foi o dia?" }),
  ).toBeVisible();

  await fillExampleDay(page);
  await expect(hero(page)).toContainText("R$ 350,50");
  await expect(hero(page)).toContainText("R$ 41,24 por hora");

  await addExpense(page, "Combustível", "85,00", async (p) => {
    const sheet = p.getByRole("dialog", { name: "Combustível" });
    await sheet.getByLabel("Litros").fill("14,2");
    await sheet.getByLabel("Odômetro").fill("52340");
    await sheet.getByRole("switch", { name: "Enchi o tanque" }).click();
  });
  await addExpense(page, "Alimentação", "22");
  await expect(hero(page)).toContainText("R$ 243,50");
  await expect(
    page.getByRole("button", { name: /Combustível, R\$ 85,00/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Mais opções" }).click();
  await page.getByRole("button", { name: "Noite", exact: true }).click();

  await page.getByRole("button", { name: "Fechar o dia" }).click();
  await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();

  await expect
    .poll(async () => (await serverDay(today())).length, { timeout: 10_000 })
    .toBe(1);
  const [day] = await serverDay(today());
  expect(day).toMatchObject({
    minutes: 510,
    km: 142,
    is_day_off: false,
    shifts: ["evening"],
  });
  expect(
    day!.earnings.map((e) => e.amount_cents).sort((a, b) => a - b),
  ).toEqual([4000, 9800, 21250]);
  expect(day!.earnings.find((e) => e.source === "other")?.label).toBe(
    "inDrive",
  );
  expect(day!.expenses).toEqual(
    expect.arrayContaining([
      {
        category: "fuel",
        amount_cents: 8500,
        liters: 14.2,
        odometer_km: 52340,
        full_tank: true,
      },
      {
        category: "food",
        amount_cents: 2200,
        liters: null,
        odometer_km: null,
        full_tank: null,
      },
    ]),
  );
});

test("registering the same day again edits it", async ({ page }) => {
  await signIn(page, user);
  await page.getByLabel("Ganho Uber, em reais").fill("100");
  await page.getByRole("button", { name: "Fechar o dia" }).click();
  await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();
  await expect
    .poll(async () => (await serverDay(today())).length, { timeout: 10_000 })
    .toBe(1);

  await page.reload();
  await expect(page.getByLabel("Ganho Uber, em reais")).toHaveValue("100,00");
  await expect(
    page.getByRole("button", { name: "Salvar alterações" }),
  ).toBeVisible();
  await page.getByLabel("Ganho Uber, em reais").fill("150");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();

  await expect
    .poll(
      async () => (await serverDay(today()))[0]?.earnings[0]?.amount_cents,
      { timeout: 10_000 },
    )
    .toBe(15000);
  expect(await serverDay(today())).toHaveLength(1);
});

test("works offline and syncs when the connection comes back", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium");
  await signIn(page, user);
  await expect(page.getByLabel("Ganho Uber, em reais")).toBeVisible();
  // Let the service worker cache the app.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          if (!navigator.serviceWorker.controller) return 0;
          const name = (await caches.keys()).find((k) =>
            k.startsWith("kmplus-pages-"),
          );
          return name ? (await (await caches.open(name)).keys()).length : 0;
        }),
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(5);

  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Como foi o dia?" }),
  ).toBeVisible();
  await page.getByLabel("Ganho Uber, em reais").fill("212,50");
  await page.getByLabel("Horas rodadas").fill("8,5");
  await page.getByRole("button", { name: "Fechar o dia" }).click();
  await expect(
    page.getByText(
      "Dia salvo no aparelho. Envia sozinho quando voltar o sinal.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Sem internet · 1 dia para enviar"),
  ).toBeVisible();
  expect(await serverDay(today())).toHaveLength(0);

  // Offline tab switch still works (served by the service worker).
  await page.getByRole("link", { name: "Painel" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Painel" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Registrar" }).click();
  await expect(page.getByLabel("Ganho Uber, em reais")).toHaveValue("212,50");

  await context.setOffline(false);
  await expect
    .poll(async () => (await serverDay(today())).length, { timeout: 15_000 })
    .toBe(1);
  await expect(page.getByText(/para enviar/)).toBeHidden({ timeout: 10_000 });
});

test("explains what is missing and keeps the driver on the field", async ({
  page,
}) => {
  await signIn(page, user);
  await page.getByRole("button", { name: "Fechar o dia" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Informe pelo menos um ganho" }),
  ).toBeVisible();

  await page.getByLabel("Ganho Uber, em reais").fill("100");
  await page.getByLabel("Horas rodadas").fill("30");
  await page.getByRole("button", { name: "Fechar o dia" }).click();
  await expect(
    page.getByText("Horas inválidas. Exemplo: 8,5 ou 8h30"),
  ).toBeVisible();
  await expect(page.getByLabel("Horas rodadas")).toBeFocused();
});

test("marks a day off and registers a previous day", async ({ page }) => {
  await signIn(page, user);
  await page.getByRole("button", { name: "Dia anterior" }).click();
  await expect(
    page.getByRole("heading", { name: "Como foi esse dia?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mais opções" }).click();
  await page.getByRole("switch", { name: "Dia de folga" }).click();
  await expect(page.getByText("Descansar também faz parte.")).toBeVisible();
  await expect(page.getByLabel("Ganho Uber, em reais")).toBeHidden();
  await page.getByRole("button", { name: "Fechar o dia" }).click();
  await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();

  const yesterday = addDays(today(), -1);
  await expect
    .poll(async () => (await serverDay(yesterday))[0]?.is_day_off, {
      timeout: 10_000,
    })
    .toBe(true);
  await page.getByRole("button", { name: "Voltar para hoje" }).click();
  await expect(
    page.getByRole("heading", { name: "Como foi o dia?" }),
  ).toBeVisible();
});

test("splits hours between apps", async ({ page }) => {
  await signIn(page, user);
  await page.getByRole("button", { name: "Mais opções" }).click();
  await page.getByRole("switch", { name: "Dividir horas entre apps" }).click();
  await page.getByLabel("Ganho Uber, em reais").fill("200");
  await page.getByLabel("Horas na Uber").fill("5");
  await page.getByLabel("Ganho 99, em reais").fill("100");
  await page.getByLabel("Horas na 99").fill("3");
  await expect(hero(page)).toContainText("R$ 37,50 por hora");
  await page.getByRole("button", { name: "Fechar o dia" }).click();
  await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();
  await expect
    .poll(async () => (await serverDay(today()))[0]?.minutes, {
      timeout: 10_000,
    })
    .toBe(480);
});

test.describe("sign-out", () => {
  // Signing out ends the session, so this test uses its own user, not the worker account.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("signing out erases the data stored on the device", async ({ page }) => {
    const own = await createTestUser({ onboarded: true, apps: ["uber"] });
    await grantPremium(own);
    try {
      await signIn(page, own);
      await page.getByLabel("Ganho Uber, em reais").fill("100");
      await page.getByRole("button", { name: "Fechar o dia" }).click();
      await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();
      const db = await adminClient();
      await expect
        .poll(
          async () =>
            (await db.from("days").select("id").eq("user_id", own.id)).data
              ?.length,
        )
        .toBe(1);

      await page.goto("/ajustes");
      await page.getByRole("button", { name: "Sair da conta" }).click();
      await expect(page).toHaveURL(/\/entrar$/);
      const dbs = await page.evaluate(async () =>
        (await indexedDB.databases()).map((d) => d.name),
      );
      expect(dbs).not.toContain("kmplus");
    } finally {
      await deleteTestUser(own);
    }
  });
});

test.describe("zeroing a day", () => {
  let user: TestUser;
  test.beforeEach(async ({ account }) => {
    user = await resetAccount(account, { apps: ["uber", "99"] });
  });

  test("erasing the values of a saved day saves it zeroed", async ({
    page,
  }) => {
    await signIn(page, user);
    await page.getByLabel("Ganho Uber, em reais").fill("300");
    await page.getByLabel("Horas rodadas").fill("8");
    await page.getByRole("button", { name: "Fechar o dia" }).click();
    await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();

    await page.getByLabel("Ganho Uber, em reais").fill("");
    await page.getByLabel("Horas rodadas").fill("");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();
    await expect(
      page
        .locator("[aria-live='polite']")
        .filter({ hasText: "Sobrou no bolso" }),
    ).toContainText("R$ 0,00");

    const db = await adminClient();
    await expect
      .poll(
        async () => {
          const { data } = await db
            .from("days")
            .select("minutes,earnings(amount_cents)")
            .eq("user_id", user.id)
            .eq("date", today())
            .single();
          return data
            ? { minutes: data.minutes, n: data.earnings.length }
            : null;
        },
        { timeout: 10_000 },
      )
      .toEqual({ minutes: null, n: 0 });
  });

  test("the clear button empties a saved day after confirming", async ({
    page,
  }) => {
    await signIn(page, user);
    await page.getByLabel("Ganho Uber, em reais").fill("150");
    await page.getByRole("button", { name: "Fechar o dia" }).click();
    await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Apagar os dados deste dia" })
      .click();
    await expect(page.getByLabel("Ganho Uber, em reais")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Apagar os dados deste dia" }),
    ).toBeHidden();
    const db = await adminClient();
    await expect
      .poll(
        async () =>
          (
            await db
              .from("days")
              .select("earnings(amount_cents)")
              .eq("user_id", user.id)
              .eq("date", today())
              .single()
          ).data?.earnings.length,
        {
          timeout: 10_000,
        },
      )
      .toBe(0);
  });
});

test("shows today's goal from the month goal and updates while typing", async ({
  page,
}) => {
  await setProfile(user, { monthly_goal_cents: 300000 });
  await signIn(page, user, "/registrar");
  // No days before today: R$ 3.000 spread over the days left (today included).
  const target = Math.round(300000 / remainingDaysInMonth(today()));
  const card = page.getByLabel("Meta de hoje", { exact: true });
  await expect(card).toContainText(formatBRL(target, { cents: false }));
  await expect(card).toContainText(`Faltam ${formatBRL(target, { cents: false })}`);

  await page.getByLabel("Ganho Uber, em reais").fill("50");
  await expect(card).toContainText(
    `Faltam ${formatBRL(target - 5000, { cents: false })}`,
  );
  await page
    .getByLabel("Ganho Uber, em reais")
    .fill(String(Math.ceil(target / 100) + 10));
  await expect(card).toContainText("Batida!");
});
