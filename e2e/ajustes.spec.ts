import { expect, test } from "./support/fixtures";
import { test as plain } from "@playwright/test";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  grantPremium,
  resetAccount,
  seedDays,
  signIn,
  type TestUser,
} from "./support/supabase";
import { today } from "../lib/dates";

test.describe("signed-in settings", () => {
  let user: TestUser;
  test.beforeEach(async ({ account }) => {
    user = await resetAccount(account, { apps: ["uber", "99"] });
    const db = await adminClient();
    await db.from("platform_settings").insert([
      { user_id: user.id, source: "uber", mode: "net_already" },
      { user_id: user.id, source: "99", mode: "net_already" },
    ]);
  });

  test("daily reminder: turns on with this device and off again", async ({
    page,
  }) => {
    await grantPremium(user);
    const endpoint = `https://push.example.com/e2e-${user.id}`;
    // The test browser cannot reach a real push service: simulate one.
    await page.addInitScript((ep) => {
      let current: unknown = null;
      const fake = {
        toJSON: () => ({
          endpoint: ep,
          keys: { p256dh: "B" + "A".repeat(86), auth: "A".repeat(22) },
        }),
      };
      PushManager.prototype.getSubscription = async () =>
        current as PushSubscription | null;
      PushManager.prototype.subscribe = async () =>
        (current = fake) as unknown as PushSubscription;
      Object.defineProperty(Notification, "permission", {
        get: () => "granted",
      });
      Notification.requestPermission = async () => "granted";
    }, endpoint);
    await signIn(page, user, "/ajustes");
    await page.getByLabel("Horário").selectOption("21:15");
    await page
      .getByRole("switch", { name: "Lembrete para fechar o dia" })
      .click();
    await expect(page.getByText("Às 21:15, se o dia ainda não")).toBeVisible();

    const db = await adminClient();
    const state = async () => {
      const [{ data: p }, { data: subs }] = await Promise.all([
        db
          .from("profiles")
          .select("reminder_enabled,reminder_time")
          .eq("id", user.id)
          .single(),
        db.from("push_subscriptions").select("endpoint").eq("user_id", user.id),
      ]);
      return { ...p, subs: (subs ?? []).map((x) => x.endpoint) };
    };
    expect(await state()).toEqual({
      reminder_enabled: true,
      reminder_time: "21:15:00",
      subs: [endpoint],
    });

    await page
      .getByRole("switch", { name: "Lembrete para fechar o dia" })
      .click();
    await expect(page.getByText("Lembrete desligado.")).toBeVisible();
    expect(await state()).toMatchObject({ reminder_enabled: false, subs: [] });
  });

  test("edits goal and routine", async ({ page }) => {
    await signIn(page, user, "/ajustes");
    await page.getByLabel("Meta de sobra por mês").fill("7.500");
    await page.getByLabel("Horas/dia").fill("9");
    await page.getByLabel("Dias por mês").fill("25");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Salvo." }),
    ).toBeVisible();
    const db = await adminClient();
    const { data } = await db
      .from("profiles")
      .select("monthly_goal_cents,typical_hours_per_day,typical_days_per_month")
      .eq("id", user.id)
      .single();
    expect(data).toEqual({
      monthly_goal_cents: 750000,
      typical_hours_per_day: 9,
      typical_days_per_month: 25,
    });
  });

  test("an app fee changes what is left in the pocket", async ({ page }) => {
    await signIn(page, user, "/ajustes");
    await page
      .getByRole("button", { name: /Uber.*já lanço o que recebi/ })
      .click();
    const sheet = page.getByRole("dialog", { name: "Uber" });
    await sheet.getByText("Percentual por corrida").click();
    await sheet.getByLabel("Taxa do app").fill("25");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(
      page.getByRole("button", { name: /Uber.*25% por corrida/ }),
    ).toBeVisible();

    await page.goto("/registrar");
    await page.getByLabel("Ganho Uber, em reais").fill("100");
    await expect(
      page
        .locator("[aria-live='polite']")
        .filter({ hasText: "Sobrou no bolso" }),
    ).toContainText("R$ 75,00");
  });

  test("exports the data as a ZIP of CSV files", async ({ page }) => {
    await seedDays(user, [
      {
        date: today(),
        minutes: 480,
        km: 120,
        earnings: [{ source: "uber", amount_cents: 21250 }],
      },
    ]);
    await signIn(page, user, "/ajustes");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Exportar meus dados" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^km-mais-meus-dados-\d{4}-\d{2}-\d{2}\.zip$/,
    );
    const path = await download.path();
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    const text = bytes.toString("utf8");
    expect(text).toContain("ganhos.csv");
    expect(text).toContain(`${today()};uber;;212,50;`);
  });
});

plain.describe("public legal pages", () => {
  plain(
    "terms and privacy are drafts and reachable without signing in",
    async ({ page }) => {
      await page.goto("/termos");
      await expect(
        page.getByRole("heading", { level: 1, name: "Termos de uso do Km+" }),
      ).toBeVisible();
      await expect(page.getByText("RASCUNHO")).toHaveCount(0);
      await expect(
        page
          .getByText("não é afiliado à Uber nem à 99", { exact: false })
          .first(),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Política de privacidade" })
        .first()
        .click();
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Política de privacidade do Km+",
        }),
      ).toBeVisible();
      await expect(page.getByRole("table")).toBeVisible();
    },
  );
});

plain.describe("account deletion", () => {
  let own: TestUser;
  plain.beforeEach(async () => {
    own = await createTestUser({ onboarded: true, apps: ["uber"] });
    await grantPremium(own);
    await seedDays(own, [
      { date: today(), earnings: [{ source: "uber", amount_cents: 1000 }] },
    ]);
  });
  plain.afterEach(async () => {
    await deleteTestUser(own).catch(() => undefined);
  });

  plain(
    "deletes the account, its data and the copy on the device",
    async ({ page }) => {
      await signIn(page, own, "/ajustes");
      await page.getByRole("button", { name: "Excluir minha conta" }).click();
      const sheet = page.getByRole("dialog", { name: "Excluir minha conta" });
      await expect(
        sheet.getByRole("button", { name: "Excluir conta para sempre" }),
      ).toBeDisabled();
      await sheet.getByLabel("Digite EXCLUIR para confirmar").fill("excluir");
      await sheet
        .getByRole("button", { name: "Excluir conta para sempre" })
        .click();
      await plain.expect(page).toHaveURL(/\/entrar\?conta=excluida$/);
      await plain
        .expect(
          page
            .getByRole("status")
            .filter({ hasText: "Sua conta e seus dados foram excluídos." }),
        )
        .toBeVisible();

      const db = await adminClient();
      const { data: days } = await db
        .from("days")
        .select("id")
        .eq("user_id", own.id);
      expect(days).toEqual([]);
      const { data: u } = await db.auth.admin.getUserById(own.id);
      expect(u.user).toBeNull();
      await plain.expect
        .poll(() =>
          page.evaluate(async () =>
            (await indexedDB.databases()).map((d) => d.name).includes("kmplus"),
          ),
        )
        .toBe(false);
    },
  );
});
