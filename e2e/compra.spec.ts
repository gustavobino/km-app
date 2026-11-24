import { expect, test } from "@playwright/test";
import {
  mercadoPagoManifest,
  signMercadoPago,
} from "../lib/payments/signature";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  grantPremium,
  signIn,
  type TestUser,
} from "./support/supabase";

const WEBHOOK_SECRET = process.env.E2E_WEBHOOK_SECRET ?? "e2e-webhook-secret";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com";

test.describe("without the purchase", () => {
  let user: TestUser;
  test.beforeEach(async () => {
    user = await createTestUser({ onboarded: true });
  });
  test.afterEach(async () => {
    await deleteTestUser(user);
  });

  test("every app screen leads to the purchase page; settings stay open", async ({
    page,
  }) => {
    await signIn(page, user);
    await expect(page).toHaveURL(/\/comprar$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Saiba quanto sobra no seu bolso",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("R$ 17,90", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "7 dias de garantia" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Comprar por R$ 17,90" }),
    ).toBeVisible();

    for (const path of [
      "/painel",
      "/painel/lucro",
      "/simulador",
      "/insights",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/comprar$/);
    }
    // LGPD: account settings work without paying.
    await page.getByRole("link", { name: "Minha conta" }).click();
    await expect(page).toHaveURL(/\/ajustes$/);
    await expect(
      page.getByRole("button", { name: "Sair da conta" }),
    ).toBeVisible();
  });

  test("after paying, the page waits for the confirmation and opens the app", async ({
    page,
  }) => {
    await signIn(page, user, "/comprar?status=pendente");
    await expect(
      page.getByRole("heading", { name: "Confirmando seu pagamento…" }),
    ).toBeVisible();
    // The webhook (simulated here) grants the access.
    await grantPremium(user);
    await expect(page).toHaveURL(/\/registrar$/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Como foi o dia?" }),
    ).toBeVisible();
  });

  test("a failed payment says so and offers to try again", async ({ page }) => {
    await signIn(page, user, "/comprar?status=falha");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "O pagamento não foi concluído" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Comprar por R$ 17,90" }),
    ).toBeVisible();
  });

  test("buying without payment credentials fails gracefully", async ({
    page,
  }) => {
    test.skip(
      Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
      "real credentials configured",
    );
    await signIn(page, user, "/comprar");
    await page.getByRole("button", { name: "Comprar por R$ 17,90" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "O pagamento está indisponível agora" }),
    ).toBeVisible();
  });
});

test.describe("webhook", () => {
  const url = (q: string) => `/api/webhooks/mercadopago?${q}`;
  function sign(dataId: string, requestId = "req-e2e") {
    const ts = String(Math.floor(Date.now() / 1000));
    const v1 = signMercadoPago(
      WEBHOOK_SECRET,
      mercadoPagoManifest(dataId, requestId, ts),
    );
    return { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId };
  }

  test("rejects unsigned or forged notifications", async ({ request }) => {
    const unsigned = await request.post(url("data.id=123&type=payment"), {
      data: { type: "payment", data: { id: "123" } },
    });
    expect(unsigned.status()).toBe(401);
    const forged = await request.post(url("data.id=123&type=payment"), {
      headers: sign("999"),
      data: {},
    });
    expect(forged.status()).toBe(401);
  });

  test("accepts signed notifications and ignores non-payment events", async ({
    request,
  }) => {
    const other = await request.post(url("data.id=55&type=merchant_order"), {
      headers: sign("55"),
      data: {},
    });
    expect(other.status()).toBe(200);
    expect(await other.json()).toEqual({ ignored: true });
  });
});

test.describe("admin", () => {
  let admin: TestUser;
  let target: TestUser;
  test.beforeEach(async () => {
    admin = await createTestUser({ onboarded: true });
    const db = await adminClient();
    // The admin is whoever is in ADMIN_EMAILS: give this user that e-mail.
    const existing = (
      await db.auth.admin.listUsers({ perPage: 1000 })
    ).data.users.find((u) => u.email === ADMIN_EMAIL);
    if (existing) await db.auth.admin.deleteUser(existing.id);
    await db.auth.admin.updateUserById(admin.id, {
      email: ADMIN_EMAIL,
      email_confirm: true,
    });
    admin = { ...admin, email: ADMIN_EMAIL };
    target = await createTestUser({ onboarded: true });
  });
  test.afterEach(async () => {
    await deleteTestUser(admin);
    await deleteTestUser(target);
  });

  test("grants and revokes access", async ({ page }) => {
    await signIn(page, admin, "/admin");
    await expect(
      page.getByRole("heading", { level: 1, name: "Admin" }),
    ).toBeVisible();
    await page.getByLabel("Buscar por e-mail").fill(target.email);
    await page.getByRole("button", { name: "Buscar" }).click();
    const row = page.getByRole("listitem").filter({ hasText: target.email });
    await expect(row).toContainText("Sem acesso");
    await row.getByRole("button", { name: "Dar acesso" }).click();
    await expect(row).toContainText("Com acesso (manual)");

    page.once("dialog", (d) => d.accept("reembolso"));
    await row.getByRole("button", { name: "Revogar acesso" }).click();
    await expect(row).toContainText("Sem acesso");
    const db = await adminClient();
    const { data } = await db
      .from("entitlements")
      .select("revoked_at,revoke_reason")
      .eq("user_id", target.id);
    expect(data).toEqual([
      { revoked_at: expect.any(String), revoke_reason: "reembolso" },
    ]);
  });

  test("is hidden from everyone else", async ({ page }) => {
    await signIn(page, target, "/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toHaveCount(0);
    await expect(
      page.getByText(/404|não encontrada|could not be found/i).first(),
    ).toBeVisible();
  });
});
