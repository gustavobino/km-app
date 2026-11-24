import { expect, test } from "@playwright/test";
import { today } from "../lib/dates";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  grantPremium,
  signIn,
  type TestUser,
} from "./support/supabase";

/**
 * Smoke test of a deployed site. Runs only with E2E_BASE_URL set:
 *   E2E_BASE_URL=https://km-app-three.vercel.app scripts/e2e-cloud.sh e2e/producao.spec.ts --project=mobile
 */
test.skip(
  !process.env.E2E_BASE_URL,
  "set E2E_BASE_URL to run against a deployed site",
);

let user: TestUser;
test.beforeEach(async () => {
  user = await createTestUser();
});
test.afterEach(async () => {
  await deleteTestUser(user);
});

test("deployed site: login, onboarding, purchase, register", async ({
  page,
}) => {
  // The test browser cannot open mercadopago.com.br from this network: answer it locally.
  await page.route(/mercadopago\.com\.br/, (r) =>
    r.fulfill({ status: 200, contentType: "text/html", body: "<h1>MP</h1>" }),
  );

  await signIn(page, user);
  await expect(page).toHaveURL(/\/onboarding$/);
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Pular", exact: true }).click();
  await page.getByRole("button", { name: "Pular e começar" }).click();

  await expect(page).toHaveURL(/\/comprar$/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Comprar por R$ 17,90" }).click();
  await page.waitForURL(/mercadopago\.com\.br/, {
    timeout: 30_000,
    waitUntil: "commit",
  });
  expect(new URL(page.url()).searchParams.get("pref_id")).toBeTruthy();

  await grantPremium(user);
  await page.goto("/registrar");
  await page.getByLabel("Ganho Uber, em reais").fill("212,50");
  await page.getByLabel("Horas rodadas").fill("8,5");
  await page.getByRole("button", { name: "Fechar o dia" }).click();
  await expect(page.getByText("Dia fechado e salvo.")).toBeVisible();

  const db = await adminClient();
  await expect
    .poll(
      async () =>
        (
          await db
            .from("days")
            .select("minutes")
            .eq("user_id", user.id)
            .eq("date", today())
        ).data?.[0]?.minutes,
      {
        timeout: 15_000,
      },
    )
    .toBe(510);
});
