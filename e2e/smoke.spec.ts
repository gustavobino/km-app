import { expect, test } from "@playwright/test";
import { test as signedInTest } from "./support/fixtures";
import { resetAccount, signIn, type TestUser } from "./support/supabase";

signedInTest.describe("signed in", () => {
  let user: TestUser;
  signedInTest.beforeEach(async ({ account }) => {
    user = await resetAccount(account);
  });

  signedInTest("tabs navigate", async ({ page }) => {
    await signIn(page, user);
    await expect(page).toHaveURL(/\/registrar$/);
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Registrar" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    for (const [label, path, heading] of [
      ["Painel", "/painel", "Painel"],
      ["Simulador", "/simulador", "Simulador de meta"],
      ["Insights", "/insights", "Insights"],
    ] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });

  signedInTest(
    "Registrar opens offline after sign-in",
    async ({ page, context, browserName }) => {
      test.skip(browserName !== "chromium");
      await signIn(page, user);
      await expect(page).toHaveURL(/\/registrar$/);
      // Wait until the service worker has cached the app tabs.
      await expect
        .poll(
          () =>
            page.evaluate(async () => {
              const keys = await caches.keys();
              const pages = keys.find((k) => k.startsWith("kmplus-pages-"));
              if (!pages) return 0;
              return (await (await caches.open(pages)).keys()).length;
            }),
          { timeout: 15_000 },
        )
        .toBeGreaterThanOrEqual(5);
      await context.setOffline(true);
      await page.goto("/painel").catch(() => undefined);
      await expect(
        page.getByRole("heading", { level: 1, name: "Painel" }),
      ).toBeVisible();
      await context.setOffline(false);
    },
  );
});

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Entre com seu e-mail" }),
  ).toBeVisible();
});

test("serves a valid PWA manifest", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    name: "Km+",
    lang: "pt-BR",
    display: "standalone",
    start_url: "/registrar",
  });
  for (const icon of manifest.icons as Array<{ src: string }>) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});

test("the dev components page is hidden in production", async ({ request }) => {
  const res = await request.get("/dev/componentes");
  expect(res.status()).toBe(404);
});
