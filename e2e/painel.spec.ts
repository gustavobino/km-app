import { expect, test } from "./support/fixtures";
import type { Page } from "@playwright/test";
import { addDays, monthRange, today, weekRange } from "../lib/dates";
import { bars, summarizeRange, variation } from "../lib/metrics/period";
import type { DayData } from "../lib/metrics/types";
import { formatBRL } from "../lib/money";
import {
  seedDays,
  setProfile,
  resetAccount,
  signIn,
  type SeedDay,
  type TestUser,
} from "./support/supabase";

let user: TestUser;
const T = today();
const Y = addDays(T, -1);

// Today = the CLAUDE.md example day, with hours split between Uber and 99.
const SEED: SeedDay[] = [
  {
    date: T,
    minutes: 510,
    km: 142,
    earnings: [
      { source: "uber", amount_cents: 21250, minutes: 300 },
      { source: "99", amount_cents: 9800, minutes: 180 },
      { source: "other", label: "inDrive", amount_cents: 4000 },
    ],
    expenses: [
      { category: "fuel", amount_cents: 8500 },
      { category: "food", amount_cents: 2200 },
    ],
  },
  {
    date: Y,
    minutes: 480,
    km: 100,
    earnings: [{ source: "uber", amount_cents: 20000 }],
  },
];

/** The same seed as DayData, to compute what the screen should show. */
const DATA: DayData[] = SEED.map((d) => ({
  date: d.date,
  minutes: d.minutes ?? null,
  km: d.km ?? null,
  isDayOff: false,
  shifts: null,
  earnings: (d.earnings ?? []).map((e) => ({
    source: e.source,
    label: e.label ?? null,
    amountCents: e.amount_cents,
    minutes: e.minutes ?? null,
  })),
  expenses: (d.expenses ?? []).map((x) => ({
    category: x.category,
    label: null,
    amountCents: x.amount_cents,
    liters: null,
    odometerKm: null,
    fullTank: null,
  })),
}));

const hero = (page: Page) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /Sobrou no bolso/ }) });

test.beforeEach(async ({ account }) => {
  user = await resetAccount(account, { apps: ["uber", "99", "inDrive"] });
});

test("shows a friendly empty state before the first day", async ({ page }) => {
  await signIn(page, user, "/painel");
  await expect(
    page.getByRole("heading", {
      name: "Registre seu primeiro dia para ver o painel",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Registrar o dia" }).click();
  await expect(page).toHaveURL(/\/registrar$/);
});

test("today, week and month with the example numbers", async ({ page }) => {
  await seedDays(user, SEED);
  await setProfile(user, { monthly_goal_cents: 800000 });
  await signIn(page, user, "/painel");

  // Hoje: the CLAUDE.md example day.
  await page.getByRole("button", { name: "Hoje" }).click();
  await expect(hero(page)).toContainText("R$ 243,50");
  await expect(hero(page)).toContainText("Ganhos R$ 350,50 · gastos R$ 107,00");
  await expect(page.getByText("R$ 41,24")).toBeVisible();
  await expect(page.getByText("em 8,5 h rodadas")).toBeVisible();
  await expect(page.getByText("R$ 2,47")).toBeVisible();
  // +22% vs yesterday (243,50 vs 200,00).
  await expect(
    page.getByRole("img", { name: "22% a mais que ontem" }),
  ).toBeVisible();
  // Uber × 99 per hour only uses hours informed per app: 212,50/5 h and 98,00/3 h.
  const apps = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Uber × 99, por hora" }),
  });
  await expect(apps).toContainText("R$ 42,50");
  await expect(apps).toContainText("R$ 32,67");

  // Semana and Mês: computed with the same (unit-tested) functions.
  for (const [label, range] of [
    ["Semana", weekRange(T)],
    ["Mês", monthRange(T)],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const s = summarizeRange(DATA, range, [], T);
    await expect(hero(page)).toContainText(formatBRL(s.netCents));
  }

  // Tapping a week bar shows that week's value (and tapping again hides it).
  const weekBar = bars("month", monthRange(T), DATA, [], T).find(
    (b) => b.range.start <= T && T <= b.range.end,
  )!;
  const barButton = page.getByRole("button", {
    name: new RegExp(`^${weekBar.longLabel}:`),
  });
  await expect(
    page.getByText("Toque numa barra para ver o valor."),
  ).toBeVisible();
  await barButton.click();
  await expect(barButton).toHaveAttribute("aria-pressed", "true");
  await expect(hero(page)).toContainText(
    `${formatBRL(weekBar.netCents)} no bolso · ganhos ${formatBRL(weekBar.grossCents)}`,
  );
  await barButton.click();
  await expect(
    page.getByText("Toque numa barra para ver o valor."),
  ).toBeVisible();

  // Month goal: R$ 8.000.
  const month = summarizeRange(DATA, monthRange(T), [], T);
  const pct = Math.floor((month.netCents / 800000) * 100);
  const goal = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /Meta do mês/ }) });
  await expect(goal).toContainText(`${pct}%`);
  await expect(goal).toContainText(
    `Faltam ${formatBRL(800000 - month.netCents, { cents: false })}`,
  );

  // The chosen period is remembered.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mês", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  // Link to Lucro líquido.
  await page.getByRole("link", { name: "Ver o lucro líquido do mês" }).click();
  await expect(page).toHaveURL(/\/painel\/lucro$/);
});

test("without hours per app shows each app's share instead of per hour", async ({
  page,
}) => {
  await seedDays(user, [
    {
      date: T,
      earnings: [
        { source: "uber", amount_cents: 30000 },
        { source: "99", amount_cents: 10000 },
      ],
    },
  ]);
  await signIn(page, user, "/painel");
  await page.getByRole("button", { name: "Hoje" }).click();
  const apps = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Quanto veio de cada app" }),
  });
  await expect(apps).toContainText("75%");
  await expect(apps).toContainText("25%");
  // No hours/km: rates hidden with a gentle hint; no goal card without a goal.
  await expect(
    page.getByText("Informe horas e km ao registrar o dia"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Meta do mês/ })).toHaveCount(
    0,
  );
  // No previous day to compare with: no badge.
  expect(variation(40000, 0)).toBeNull();
  await expect(page.getByRole("img", { name: /a mais|a menos/ })).toHaveCount(
    0,
  );
});
