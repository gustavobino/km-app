import { describe, expect, it } from "vitest";
import {
  categoryAverageMaintenance,
  findVehicleModel,
  modelMaintenanceCentsPerKm,
  normalizeCarText,
  TIRES_CENTS_PER_KM,
  VEHICLE_MODELS,
  WEAR_CENTS_PER_KM,
} from "./vehicle-models";

describe("findVehicleModel", () => {
  it.each([
    [null, "Kwid", "renault-kwid"],
    ["Renault", "KWID 1.0 Zen", "renault-kwid"],
    ["", "kwid 2020", "renault-kwid"],
    ["Chevrolet", "Onix", "chevrolet-onix"],
    [null, "Onix Plus LT", "chevrolet-onix-plus"],
    [null, "onix sedan", "chevrolet-onix-plus"],
    ["Hyundai", "HB20", "hyundai-hb20"],
    [null, "HB 20 Comfort", "hyundai-hb20"],
    [null, "HB20S", "hyundai-hb20s"],
    [null, "hb20 sedan", "hyundai-hb20s"],
    ["Fiat", "Mobi Like", "fiat-mobi"],
    ["VW", "Gol 1.0", "vw-gol"],
    [null, "Voyage", "vw-voyage"],
    [null, "Polo Track", "vw-polo"],
    [null, "Virtus", "vw-virtus"],
    [null, "Argo Drive", "fiat-argo"],
    [null, "Cronos", "fiat-cronos"],
    [null, "Sandero Stepway", "renault-sandero"],
    [null, "Stepway", "renault-sandero"],
    [null, "Logan", "renault-logan"],
    ["Ford", "Ka", "ford-ka"],
    ["Ford", "Ka+ Sedan", "ford-ka-sedan"],
    [null, "ka sedan", "ford-ka-sedan"],
  ])("%s %s → %s", (brand, model, id) => {
    expect(findVehicleModel(brand, model)?.id).toBe(id);
  });

  it("does not confuse look-alikes and returns null when unknown", () => {
    expect(findVehicleModel("VW", "Golf")).toBeNull();
    expect(findVehicleModel(null, "Polonia")).toBeNull();
    expect(findVehicleModel("Fiat", "Uno")).toBeNull();
    expect(findVehicleModel(null, null)).toBeNull();
    expect(findVehicleModel("  ", "")).toBeNull();
  });

  it("normalises accents, case and symbols", () => {
    expect(normalizeCarText("  Citroën  C3-Aircross ")).toBe("citroen c3 aircross");
  });
});

describe("cost per km", () => {
  it("wear = brakes R$ 1.600/35 mil km + suspension R$ 1.500/45 mil km", () => {
    expect(WEAR_CENTS_PER_KM).toBeCloseTo(7.9, 2);
    expect(TIRES_CENTS_PER_KM).toBeCloseTo(5.226, 3);
  });

  it.each([
    ["chevrolet-onix", 15.44],
    ["hyundai-hb20", 15.21],
    ["renault-kwid", 15.38],
    ["fiat-mobi", 16.32],
    ["vw-gol", 14.24],
    ["renault-sandero", 13.18],
  ])("%s ≈ %s ¢/km", (id, value) => {
    const m = VEHICLE_MODELS.find((x) => x.id === id)!;
    expect(modelMaintenanceCentsPerKm(m)).toBeCloseTo(value, 2);
  });

  it("category averages match db/seed.sql (SUV has no researched model)", () => {
    expect(categoryAverageMaintenance("compact")).toBeCloseTo(14.72, 2);
    expect(categoryAverageMaintenance("sedan")).toBeCloseTo(14.21, 2);
    expect(categoryAverageMaintenance("other")).toBeCloseTo(14.5, 2);
    expect(categoryAverageMaintenance("suv")).toBeNull();
  });

  it("every model has a plausible plan", () => {
    for (const m of VEHICLE_MODELS) {
      expect(m.servicesKm).toBeGreaterThanOrEqual(50_000);
      expect(m.servicesPriceYear).toBeGreaterThanOrEqual(2020);
      expect(new Set(VEHICLE_MODELS.map((x) => x.id)).size).toBe(
        VEHICLE_MODELS.length,
      );
    }
  });
});
