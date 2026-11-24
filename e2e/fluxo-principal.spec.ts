import { expect, test } from "@playwright/test";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  grantPremium,
  type TestUser,
} from "./support/supabase";

/**
 * The whole journey of a new driver, as in CLAUDE.md:
 * login → onboarding → purchase → register a day → Painel → Simulador → Insights.
 * The payment confirmation (Mercado Pago webhook) is simulated by granting the access.
 */
let user: TestUser;
test.beforeEach(async () => {
  user = await createTestUser();
});
test.afterEach(async () => {
  await deleteTestUser(user);
});

test("new driver: from login to insights", async ({ page }) => {
  // Login: the form asks for the e-mail link (intercepted: no real e-mail)…
  await page.route("**/auth/v1/otp**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fregistrar$/);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(
    page.getByRole("heading", { name: "Enviamos um código para entrar" }),
  ).toBeVisible();
  // …and types the 6-digit code from the e-mail (as in the installed iPhone app).
  const db = await adminClient();
  const { data } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  await page.getByLabel("Código do e-mail").fill(data.properties!.email_otp);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Onboarding (one question per screen).
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: "Uber" }).click();
  await page.getByRole("button", { name: "99" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByText("Próprio").click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByText("Flex").click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Meta por mês").fill("6.000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Horas por dia").fill("8,5");
  await page.getByRole("button", { name: "Começar a usar" }).click();

  // Purchase: the app asks for it; the payment is confirmed by the webhook.
  await expect(page).toHaveURL(/\/comprar$/, { timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: "Comprar por R$ 17,90" }),
  ).toBeVisible();
  await page.goto("/comprar?status=pendente");
  await expect(
    page.getByRole("heading", { name: "Confirmando seu pagamento…" }),
  ).toBeVisible();
  await grantPremium(user);
  await expect(page).toHaveURL(/\/registrar$/, { timeout: 20_000 });

  // Register the CLAUDE.md example day.
  await page.getByLabel("Ganho Uber, em reais").fill("212,50");
  await page.getByLabel("Ganho 99, em reais").fill("98,00");
  await page.getByLabel("Horas rodadas").fill("8,5");
  await page.getByLabel("Km rodados").fill("142");
  await page
    .getByRole("button", { name: "+ Combustível", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Combustível" })
    .getByLabel("Valor")
    .fill("85");
  await page
    .getByRole("dialog", { name: "Combustível" })
    .getByRole("button", { name: "Adicionar gasto" })
    .click();
  await expect(
    page.locator("[aria-live='polite']").filter({ hasText: "Sobrou no bolso" }),
  ).toContainText("R$ 225,50");
  await page.getByRole("button", { name: "Fechar o dia" }).click();
  await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();

  // Painel shows the day.
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Painel" })
    .click();
  await page.getByRole("button", { name: "Hoje" }).click();
  await expect(
    page.locator("section").filter({
      has: page.getByRole("heading", { name: "Sobrou no bolso hoje" }),
    }),
  ).toContainText("R$ 225,50");
  await expect(page.getByText("R$ 36,53")).toBeVisible(); // 310,50 / 8,5 h

  // Simulador uses the goal from onboarding.
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Simulador" })
    .click();
  await expect(page.getByLabel("Quero chegar a")).toHaveValue("6.000");
  await expect(
    page.getByText("Ainda com pouco histórico: 1 dia com horas."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Estimativa baseada no seu histórico, não é garantia de ganho.",
    ),
  ).toBeVisible();

  // Insights: the week summary.
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Insights" })
    .click();
  await expect(
    page.locator("section").filter({ hasText: "Resumo da semana" }),
  ).toContainText("Você sobrou");
});
