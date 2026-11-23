import { expect, test } from "@playwright/test";
import { today } from "../lib/dates";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  seedDays,
  setProfile,
  setVehicle,
  signIn,
  type TestUser,
} from "./support/supabase";

let user: TestUser;

test.beforeEach(async () => {
  user = await createTestUser({ onboarded: true, apps: ["uber", "99"] });
});
test.afterEach(async () => {
  await deleteTestUser(user);
});

test("shows the example month and the car reserve as an estimate", async ({
  page,
}) => {
  // CLAUDE.md month: earnings 8.940,00; expenses 2.540,00 → 6.400,00 (71,6%).
  await seedDays(user, [
    {
      date: today(),
      km: 3000,
      earnings: [
        { source: "uber", amount_cents: 500000 },
        { source: "99", amount_cents: 394000 },
      ],
      expenses: [
        { category: "fuel", amount_cents: 188000 },
        { category: "food", amount_cents: 52000 },
        { category: "toll", amount_cents: 14000 },
      ],
    },
  ]);
  // R$ 0,22 + 0,12 per km + (2.400 + 1.200)/36.000 km = R$ 0,44/km × 3.000 km = R$ 1.320,00.
  await setProfile(user, {
    vehicle_ownership: "own",
    typical_days_per_month: 1,
  });
  await setVehicle(user, {
    brand: "Chevrolet",
    model: "Onix 1.0",
    year: 2021,
    category: "compact",
    maintenance_cents_per_km: 22,
    tires_cents_per_km: 12,
    insurance_year_cents: 240000,
    ipva_year_cents: 120000,
  });

  await signIn(page, user, "/painel");
  await page.getByRole("link", { name: "Ver o lucro líquido do mês" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Lucro líquido" }),
  ).toBeVisible();

  const hero = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /Sobrou no bolso em/ }) });
  await expect(hero).toContainText("R$ 6.400,00");
  await expect(hero).toContainText("71,6% do que você ganhou ficou com você");

  const list = page.getByRole("region", { name: "Como chegamos nesse valor" });
  await expect(list).toContainText("Ganhos do mêsR$ 8.940,00");
  await expect(list).toContainText("Combustível− R$ 1.880,00");
  await expect(list).toContainText("Alimentação− R$ 520,00");
  await expect(list).toContainText("Pedágio− R$ 140,00");

  const vehicle = page.getByRole("region", { name: "Modo veículo" });
  await expect(vehicle).toContainText("Onix 1.0 · 2021 · carro próprio");
  await expect(vehicle.getByText("Reserva do carro")).toBeHidden();

  await vehicle.getByRole("switch", { name: "Modo veículo" }).click();
  await expect(vehicle).toContainText("Reserva do carro");
  await expect(vehicle).toContainText("estimativa");
  await expect(vehicle).toContainText(
    "≈ R$ 0,44 por km, para manutenção, pneus, seguro e IPVA",
  );
  await expect(vehicle).toContainText("R$ 1.320,00");
  await expect(vehicle).toContainText("Livre depois da reservaR$ 5.080,00");

  // Saved on the server.
  const db = await adminClient();
  await expect
    .poll(
      async () =>
        (
          await db
            .from("profiles")
            .select("vehicle_mode_enabled")
            .eq("id", user.id)
            .single()
        ).data?.vehicle_mode_enabled,
    )
    .toBe(true);

  // Editing: maintenance R$ 0,30/km → R$ 0,52/km → R$ 1.560,00.
  await vehicle.getByRole("button", { name: "Editar valores" }).click();
  const sheet = page.getByRole("dialog", { name: "Valores do carro" });
  await sheet.getByLabel("Manutenção por km").fill("0,30");
  await sheet.getByRole("button", { name: "Salvar valores" }).click();
  await expect(sheet).toBeHidden();
  await expect(vehicle).toContainText("≈ R$ 0,52 por km");
  await expect(vehicle).toContainText("R$ 1.560,00");
  await expect
    .poll(async () =>
      Number(
        (
          await db
            .from("vehicles")
            .select("maintenance_cents_per_km")
            .eq("user_id", user.id)
            .single()
        ).data?.maintenance_cents_per_km,
      ),
    )
    .toBe(30);

  // Persisted across reloads.
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Modo veículo" }),
  ).toContainText("R$ 1.560,00");
});

test("rented car adds the rent and placeholders are disclosed", async ({
  page,
}) => {
  await seedDays(user, [
    {
      date: today(),
      km: 100,
      earnings: [{ source: "uber", amount_cents: 30000 }],
    },
  ]);
  await setProfile(user, {
    vehicle_ownership: "rented",
    vehicle_mode_enabled: true,
  });
  await setVehicle(user, { rent_cents: 70000, rent_period: "week" });
  await signIn(page, user, "/painel/lucro");
  const vehicle = page.getByRole("region", { name: "Modo veículo" });
  await expect(vehicle).toContainText("+ aluguel por dia");
  await expect(vehicle).toContainText("Valores de referência provisórios");
  await expect(vehicle).toContainText("Não é aconselhamento financeiro");
});

test("friendly empty month", async ({ page }) => {
  await signIn(page, user, "/painel/lucro");
  await expect(
    page.getByRole("heading", { name: /Nenhum dia registrado em/ }),
  ).toBeVisible();
});
