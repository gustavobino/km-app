import { z } from "zod";

const cents = z.number().int().min(0).max(100_000_000).nullable();
const perKm = z.number().min(0).max(1000).nullable();

/** "Editar valores" of the car (all optional). */
export const vehicleInputSchema = z
  .object({
    ownership: z.enum(["own", "rented", "financed"]).nullable(),
    brand: z.string().trim().max(40).nullable(),
    model: z.string().trim().max(60).nullable(),
    year: z.number().int().min(1980).max(2100).nullable(),
    category: z.enum(["compact", "sedan", "suv", "other"]).nullable(),
    rentCents: cents,
    rentPeriod: z.enum(["day", "week", "month"]).nullable(),
    installmentCents: cents,
    insuranceYearCents: cents,
    ipvaYearCents: cents,
    maintenanceCentsPerKm: perKm,
    tiresCentsPerKm: perKm,
  })
  .strict()
  .refine(
    (v) =>
      (v.rentCents == null) === (v.rentPeriod == null) || v.rentCents == null,
    {
      message: "rent needs a period",
    },
  );

export type VehicleInput = z.infer<typeof vehicleInputSchema>;
