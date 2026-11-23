import { expect, test } from "@playwright/test";

test("root redirects to Registrar and tabs navigate", async ({ page }) => {
  await page.goto("/");
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

test("registers the service worker and serves Registrar offline", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium");
  await page.goto("/registrar");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Ensure the SW controls the page, then go offline and reload.
  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Como foi o dia?" }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("the dev components page is hidden in production", async ({ request }) => {
  const res = await request.get("/dev/componentes");
  expect(res.status()).toBe(404);
});
