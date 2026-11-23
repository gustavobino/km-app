import { z } from "zod";

export const maintenanceItemSchema = z
  .object({
    id: z.uuid().nullable(),
    name: z.string().trim().min(1).max(60),
    intervalKm: z.number().int().min(100).max(200_000),
    lastDoneKm: z.number().int().min(0).max(9_999_999).nullable(),
    lastDoneDate: z.iso.date().nullable(),
  })
  .strict();

export type MaintenanceItemInput = z.infer<typeof maintenanceItemSchema>;
