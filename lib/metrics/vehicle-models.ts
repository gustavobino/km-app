/**
 * Per-model cost references for the "Reserva do carro" (ESTIMATES).
 *
 * The driver types the car (e.g. "Kwid 2020") and the app recognises the
 * model, then uses its averages instead of the generic per-category numbers.
 * Method, sources and dates: docs/custos.md. Never present these as facts.
 *
 *   maintenance per km = scheduled services (manufacturer fixed-price plan,
 *                        total ÷ km covered) + wear outside the plan (brakes,
 *                        suspension)
 *   tires per km       = 4 tires × average price ÷ average durability
 */
import type { Category } from "./vehicle";

/** Brakes: pads + discs R$ 1.600 (mid of R$ 1.200–2.000) every 35.000 km (mid of 30–40 mil). */
export const BRAKES_CENTS_PER_KM = 160_000 / 35_000;
/** Suspension: R$ 1.500 (mid of R$ 1.200–1.800) every 45.000 km (mid of 40–50 mil). */
export const SUSPENSION_CENTS_PER_KM = 150_000 / 45_000;
/** Wear outside the scheduled services (≈ 7,90 ¢/km). */
export const WEAR_CENTS_PER_KM = BRAKES_CENTS_PER_KM + SUSPENSION_CENTS_PER_KM;
/**
 * Tires (aro 14–15, the sizes of the cars below): 4 × R$ 653,24 (average of the
 * median prices of 175/70 R14, 185/65 R15 and 175/65 R14) ÷ 50.000 km
 * (mid of the 40–60 mil km durability range) ≈ 5,23 ¢/km.
 */
export const TIRES_CENTS_PER_KM = (4 * 65_324) / 50_000;

export type VehicleModelRef = {
  id: string;
  brand: string;
  model: string;
  category: Exclude<Category, "other">;
  /** Scheduled-service plan: total in cents, km covered and year of the prices. */
  servicesTotalCents: number;
  servicesKm: number;
  servicesPriceYear: number;
  /** Normalised words that identify the model (checked in order, most specific first). */
  match: RegExp;
};

/**
 * The cars most used on Uber and 99 in Brazil (CNN Brasil, platform data for
 * 2024), plus their sedan versions. Fiat Uno is in that list but no
 * scheduled-service prices were found, so it uses the category average.
 * Order matters: sedans before their hatch ("onix plus" before "onix").
 */
export const VEHICLE_MODELS: readonly VehicleModelRef[] = [
  {
    id: "chevrolet-onix-plus",
    brand: "Chevrolet",
    model: "Onix Plus",
    category: "sedan",
    servicesTotalCents: 452_400,
    servicesKm: 60_000,
    servicesPriceYear: 2026,
    match: /\bonix (plus|sedan)\b/,
  },
  {
    id: "chevrolet-onix",
    brand: "Chevrolet",
    model: "Onix",
    category: "compact",
    servicesTotalCents: 452_400,
    servicesKm: 60_000,
    servicesPriceYear: 2026,
    match: /\bonix\b/,
  },
  {
    id: "hyundai-hb20s",
    brand: "Hyundai",
    model: "HB20S",
    category: "sedan",
    servicesTotalCents: 438_500,
    servicesKm: 60_000,
    servicesPriceYear: 2026,
    match: /\bhb ?20 ?(s|sedan)\b/,
  },
  {
    id: "hyundai-hb20",
    brand: "Hyundai",
    model: "HB20",
    category: "compact",
    servicesTotalCents: 438_500,
    servicesKm: 60_000,
    servicesPriceYear: 2026,
    match: /\bhb ?20\b/,
  },
  {
    id: "renault-kwid",
    brand: "Renault",
    model: "Kwid",
    category: "compact",
    servicesTotalCents: 373_800,
    servicesKm: 50_000,
    servicesPriceYear: 2025,
    match: /\bkwid\b/,
  },
  {
    id: "fiat-mobi",
    brand: "Fiat",
    model: "Mobi",
    category: "compact",
    servicesTotalCents: 420_600,
    servicesKm: 50_000,
    servicesPriceYear: 2024,
    match: /\bmobi\b/,
  },
  {
    id: "vw-voyage",
    brand: "Volkswagen",
    model: "Voyage",
    category: "sedan",
    servicesTotalCents: 380_000,
    servicesKm: 60_000,
    servicesPriceYear: 2024,
    match: /\bvoyage\b/,
  },
  {
    id: "vw-gol",
    brand: "Volkswagen",
    model: "Gol",
    category: "compact",
    servicesTotalCents: 380_000,
    servicesKm: 60_000,
    servicesPriceYear: 2024,
    match: /\bgol\b/,
  },
  {
    id: "vw-virtus",
    brand: "Volkswagen",
    model: "Virtus",
    category: "sedan",
    servicesTotalCents: 357_420,
    servicesKm: 60_000,
    servicesPriceYear: 2021,
    match: /\bvirtus\b/,
  },
  {
    id: "vw-polo",
    brand: "Volkswagen",
    model: "Polo",
    category: "compact",
    servicesTotalCents: 357_420,
    servicesKm: 60_000,
    servicesPriceYear: 2021,
    match: /\bpolo\b/,
  },
  {
    id: "fiat-cronos",
    brand: "Fiat",
    model: "Cronos",
    category: "sedan",
    servicesTotalCents: 368_400,
    servicesKm: 60_000,
    servicesPriceYear: 2020,
    match: /\bcronos\b/,
  },
  {
    id: "fiat-argo",
    brand: "Fiat",
    model: "Argo",
    category: "compact",
    servicesTotalCents: 448_000,
    servicesKm: 60_000,
    servicesPriceYear: 2025,
    match: /\bargo\b/,
  },
  {
    id: "renault-logan",
    brand: "Renault",
    model: "Logan",
    category: "sedan",
    servicesTotalCents: 316_668,
    servicesKm: 60_000,
    servicesPriceYear: 2022,
    match: /\blogan\b/,
  },
  {
    id: "renault-sandero",
    brand: "Renault",
    model: "Sandero",
    category: "compact",
    servicesTotalCents: 316_668,
    servicesKm: 60_000,
    servicesPriceYear: 2022,
    match: /\b(sandero|stepway)\b/,
  },
  {
    id: "ford-ka-sedan",
    brand: "Ford",
    model: "Ka Sedan",
    category: "sedan",
    servicesTotalCents: 334_400,
    servicesKm: 60_000,
    servicesPriceYear: 2020,
    match: /\bka ?(\+|plus)? ?sedan\b/,
  },
  {
    id: "ford-ka",
    brand: "Ford",
    model: "Ka",
    category: "compact",
    servicesTotalCents: 334_400,
    servicesKm: 60_000,
    servicesPriceYear: 2020,
    match: /\bka\b/,
  },
];

/** Lowercase, no accents, only letters/digits/"+" separated by single spaces. */
export function normalizeCarText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

/** Finds the model from what the driver typed in "Marca" and "Modelo". */
export function findVehicleModel(
  brand: string | null | undefined,
  model: string | null | undefined,
): VehicleModelRef | null {
  const text = normalizeCarText(`${brand ?? ""} ${model ?? ""}`);
  if (!text) return null;
  return VEHICLE_MODELS.find((m) => m.match.test(text)) ?? null;
}

export function modelMaintenanceCentsPerKm(m: VehicleModelRef): number {
  return m.servicesTotalCents / m.servicesKm + WEAR_CENTS_PER_KM;
}

/**
 * Average of the catalogue for a category (all models when "other"); the
 * per-category rows of cost_reference (db/seed.sql) are these numbers.
 * Null when the catalogue has no car of that category (SUV).
 */
export function categoryAverageMaintenance(category: Category): number | null {
  const list = VEHICLE_MODELS.filter(
    (m) => category === "other" || m.category === category,
  );
  if (list.length === 0) return null;
  return (
    list.reduce((a, m) => a + modelMaintenanceCentsPerKm(m), 0) / list.length
  );
}
