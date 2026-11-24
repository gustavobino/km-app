import { expect, test } from "@playwright/test";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  signIn,
  type TestUser,
} from "./support/supabase";

test("login form sends the magic link and shows the next step", async ({
  page,
}) => {
  // Intercept the Supabase call: no real e-mail (the free SMTP allows 2/hour).
  let body: Record<string, unknown> | undefined;
  let requestUrl = "";
  await page.route("**/auth/v1/otp**", async (route) => {
    body = route.request().postDataJSON();
    requestUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/entrar?next=%2Fpainel");
  await page.getByLabel("E-mail").fill("  Motorista@Email.com ");
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(
    page.getByRole("heading", { name: "Enviamos um código para entrar" }),
  ).toBeVisible();
  await expect(page.getByText("motorista@email.com")).toBeVisible();
  expect(body?.email).toBe("motorista@email.com");
  // Implicit flow: no PKCE challenge, so the e-mail link works in any browser.
  expect(body?.code_challenge ?? null).toBeNull();
  const redirectTo = new URL(requestUrl).searchParams.get("redirect_to");
  expect(redirectTo).toMatch(/\/auth\/link\?next=%2Fpainel$/);
  await expect(
    page.getByRole("button", { name: /Reenviar em \d+ s/ }),
  ).toBeDisabled();
});

test("login form validates the e-mail and explains rate limits", async ({
  page,
}) => {
  await page.route("**/auth/v1/otp**", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        code: "over_email_send_rate_limit",
        msg: "rate limit",
      }),
    }),
  );
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("sem-arroba");
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Confira o e-mail" }),
  ).toBeVisible();
  await page.getByLabel("E-mail").fill("ok@email.com");
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Muitos pedidos" }),
  ).toBeVisible();
});

test("an expired link shows a clear message", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=nope&type=email");
  await expect(page).toHaveURL(/\/entrar\?erro=link$/);
  await expect(
    page.getByRole("alert").filter({ hasText: "expirou ou já foi usado" }),
  ).toBeVisible();
});

test.describe("onboarding", () => {
  let user: TestUser;
  test.beforeEach(async () => {
    user = await createTestUser();
  });
  test.afterEach(async () => {
    await deleteTestUser(user);
  });

  test("new users go through onboarding and answers are saved", async ({
    page,
  }) => {
    await signIn(page, user);
    await expect(page).toHaveURL(/\/onboarding$/);

    await expect(
      page.getByRole("heading", { name: "Em quais apps você roda?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Uber" }).click();
    await page.getByRole("button", { name: "Outro app" }).click();
    await page.getByLabel("Nome do app").fill("inDrive");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      page.getByRole("heading", { name: "Seu carro é…" }),
    ).toBeVisible();
    await page.getByText("Alugado").click();
    // Choosing "rented" adds the rent question: 5 → 6 steps.
    await expect(page.getByText("2 de 6")).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      page.getByRole("heading", { name: "Quanto você paga de aluguel?" }),
    ).toBeVisible();
    await page.getByLabel("Valor do aluguel").fill("abc");
    await page.getByLabel("Valor do aluguel").fill("700");
    await page.getByRole("button", { name: "Por semana" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      page.getByRole("heading", { name: "Qual combustível você usa?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Pular" }).click();

    await expect(
      page.getByRole("heading", { name: /Quanto você quer que sobre/ }),
    ).toBeVisible();
    await page.getByLabel("Meta por mês").fill("8.000");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      page.getByRole("heading", { name: "Como é a sua rotina?" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Diminuir dias por semana" })
      .click(); // 6 → 5
    await page.getByLabel("Horas por dia").fill("8,5");
    await page.getByRole("button", { name: "Começar a usar" }).click();

    // Onboarding done → the app asks for the purchase.
    await expect(page).toHaveURL(/\/comprar$/, { timeout: 15_000 });

    const db = await adminClient();
    const { data: profile } = await db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    expect(profile).toMatchObject({
      apps: ["uber", "inDrive"],
      vehicle_ownership: "rented",
      fuel_type: null,
      monthly_goal_cents: 800000,
      typical_days_per_month: 22,
      typical_hours_per_day: 8.5,
    });
    expect(profile.onboarding_completed_at).not.toBeNull();
    const { data: vehicle } = await db
      .from("vehicles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    expect(vehicle).toMatchObject({
      rent_cents: 70000,
      rent_period: "week",
      installment_cents: null,
    });
    const { data: platforms } = await db
      .from("platform_settings")
      .select("source,label,mode")
      .eq("user_id", user.id)
      .order("source");
    expect(platforms).toEqual([
      { source: "other", label: "inDrive", mode: "net_already" },
      { source: "uber", label: null, mode: "net_already" },
    ]);
  });

  test("skipping everything still finishes onboarding", async ({ page }) => {
    await signIn(page, user);
    await expect(page).toHaveURL(/\/onboarding$/);
    for (let i = 0; i < 4; i++)
      await page.getByRole("button", { name: "Pular", exact: true }).click();
    await page.getByRole("button", { name: "Pular e começar" }).click();
    // Onboarding done → the app asks for the purchase.
    await expect(page).toHaveURL(/\/comprar$/, { timeout: 15_000 });
  });
});

test.describe("e-mail link opened in another browser", () => {
  let user: TestUser;
  test.beforeEach(async () => {
    user = await createTestUser();
  });
  test.afterEach(async () => {
    await deleteTestUser(user);
  });

  test("the link from the e-mail signs in from any browser", async ({
    page,
    baseURL,
  }) => {
    // Same link the e-mail carries ({{ .ConfirmationURL }}), opened in a fresh
    // browser that never asked for it (e.g. the Gmail app or another phone).
    const db = await adminClient();
    const { data, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
      options: { redirectTo: `${baseURL}/auth/link?next=%2Fregistrar` },
    });
    expect(error).toBeNull();
    await page.goto(data.properties!.action_link);
    // New user → onboarding (the app is reachable, so the session is set).
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Em quais apps você roda?" }),
    ).toBeVisible();
  });

  test("the 6-digit code from the e-mail signs in", async ({ page }) => {
    await page.route("**/auth/v1/otp**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByRole("button", { name: "Receber link de acesso" }).click();
    await expect(
      page.getByRole("heading", { name: "Enviamos um código para entrar" }),
    ).toBeVisible();
    const db = await adminClient();
    const { data } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });

    await page.getByLabel("Código do e-mail").fill("000000");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Código inválido ou expirado" }),
    ).toBeVisible();

    await page.getByLabel("Código do e-mail").fill(data.properties!.email_otp);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
  });

  test("an expired link explains what to do", async ({ page }) => {
    await page.goto(
      "/auth/link?next=%2Fregistrar#error=access_denied&error_code=otp_expired",
    );
    await expect(
      page.getByRole("heading", { name: "Esse link expirou ou já foi usado" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Pedir um novo link" }).click();
    await expect(page).toHaveURL(/\/entrar$/);
  });
});
