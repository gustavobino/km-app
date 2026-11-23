import { expect, test } from "@playwright/test";
import { addDays, formatWeekdayLong, today } from "../lib/dates";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  seedDays,
  setProfile,
  setVehicle,
  signIn,
  type SeedDay,
  type TestUser,
} from "./support/supabase";

let user: TestUser;
const T = today();
const BEST = addDays(T, -2); // this weekday earns 40% more per hour

test.beforeEach(async () => {
  user = await createTestUser({ onboarded: true, apps: ["uber", "99"] });
});
test.afterEach(async () => {
  await deleteTestUser(user);
});

test("shows the week summary, every rule's card and the gentle rest line", async ({
  page,
}) => {
  const bestWeekday = new Date(`${BEST}T12:00:00Z`).getUTCDay();
  const fuelOn: Record<number, [number, number]> = {
    20: [40, 10000],
    15: [40, 10400],
    10: [40, 10800],
    5: [40, 11150],
  };
  const seed: SeedDay[] = [];
  for (let i = 0; i < 28; i++) {
    const date = addDays(T, -i);
    const best = new Date(`${date}T12:00:00Z`).getUTCDay() === bestWeekday;
    const f = fuelOn[i];
    seed.push({
      date,
      minutes: 600,
      km: 150,
      earnings:
        i === 0
          ? [
              { source: "uber", amount_cents: 21545, minutes: 300 },
              { source: "99", amount_cents: 11250, minutes: 180 },
            ]
          : [{ source: "uber", amount_cents: best ? 42000 : 30000 }],
      expenses: f ? [{ category: "fuel", amount_cents: 10000 }] : [],
    });
  }
  await seedDays(user, seed);
  // Liters/odometer/full tank for the fuel expenses.
  const db = await adminClient();
  for (const [offset, [liters, odo]] of Object.entries(fuelOn)) {
    const { data: d } = await db
      .from("days")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", addDays(T, -Number(offset)))
      .single();
    await db
      .from("expenses")
      .update({ liters, odometer_km: odo, full_tank: true })
      .eq("day_id", d!.id);
  }
  await db
    .from("maintenance_items")
    .insert({
      user_id: user.id,
      name: "Troca de óleo",
      interval_km: 10000,
      last_done_km: 1750,
    });
  await setProfile(user, {
    vehicle_mode_enabled: true,
    vehicle_ownership: "own",
  });
  await setVehicle(user, {
    maintenance_cents_per_km: 20,
    tires_cents_per_km: 5,
  });

  await signIn(page, user, "/insights");
  await expect(
    page.getByRole("heading", { level: 1, name: "Insights" }),
  ).toBeVisible();
  await expect(
    page.locator("section").filter({ hasText: "Resumo da semana" }),
  ).toContainText("Você sobrou");

  const card = (title: string | RegExp) =>
    page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card(`${formatWeekdayLong(BEST)} rende mais`)).toContainText(
    /Cerca de \d+% a mais por hora que nos outros dias\./,
  );
  await expect(card("Uber rendeu mais que a 99")).toContainText(
    "R$ 5,59 a mais por hora nesta semana.",
  );
  await expect(card("Troca de óleo chegando")).toContainText(
    "Faltam cerca de 600 km para a próxima.",
  );
  await expect(card("Reserva do carro")).toContainText("por dia rodado");
  await expect(card("O consumo piorou")).toContainText(
    "8,8 km/l no último tanque",
  );

  const rest = page.getByText(
    "28 dias seguidos rodando. Uma folga ajuda o rendimento.",
  );
  await expect(rest).toBeVisible();
  await page.getByRole("button", { name: "Dispensar" }).click();
  await expect(rest).toBeHidden();
  await page.reload();
  await expect(card("Troca de óleo chegando")).toBeVisible();
  await expect(rest).toBeHidden();
});

test("new drivers get friendly placeholders", async ({ page }) => {
  await signIn(page, user, "/insights");
  await expect(page.getByText("Sua semana começa aqui.")).toBeVisible();
  await expect(
    page.getByText("Os insights aparecem conforme você registra."),
  ).toBeVisible();
  await page.getByRole("link", { name: /Cadastre em Ajustes/ }).click();
  await expect(page).toHaveURL(/\/ajustes$/);
});

test("maintenance items can be added in Ajustes", async ({ page }) => {
  await signIn(page, user, "/ajustes");
  await page.getByRole("button", { name: "+ Troca de óleo" }).click();
  const sheet = page.getByRole("dialog", { name: "Novo item" });
  await expect(sheet.getByLabel("A cada quantos km")).toHaveValue("10000");
  await sheet.getByRole("button", { name: "Salvar" }).click();
  await expect(sheet.getByRole("alert")).toContainText(
    "Informe o km ou a data da última vez.",
  );
  await sheet.getByLabel("Última vez: km").fill("52000");
  await sheet.getByRole("button", { name: "Salvar" }).click();
  await expect(sheet).toBeHidden();
  await expect(
    page.getByRole("button", { name: /Troca de óleo.*a cada 10.000 km/ }),
  ).toBeVisible();
  const db = await adminClient();
  const { data } = await db
    .from("maintenance_items")
    .select("name,interval_km,last_done_km")
    .eq("user_id", user.id);
  expect(data).toEqual([
    { name: "Troca de óleo", interval_km: 10000, last_done_km: 52000 },
  ]);
});
