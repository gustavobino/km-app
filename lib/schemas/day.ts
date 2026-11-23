import { z } from "zod";

const uuid = z.uuid();
const cents = z.number().int().min(0).max(10_000_000);
const minutes = z.number().int().min(0).max(1440);
const label = z.string().max(40).nullable();

/** One day as the device sends it to /api/sync/days (validated on the server). */
export const dayPayloadSchema = z
  .object({
    id: uuid,
    date: z.iso.date(),
    minutes: minutes.nullable(),
    km: z.number().int().min(0).max(3000).nullable(),
    is_day_off: z.boolean(),
    shifts: z
      .array(z.enum(["morning", "afternoon", "evening", "night"]))
      .max(4)
      .nullable(),
    note: z.string().max(500).nullable(),
    client_updated_at: z.iso.datetime({ offset: true }),
    earnings: z
      .array(
        z
          .object({
            id: uuid,
            source: z.enum(["uber", "99", "other"]),
            label,
            amount_cents: cents,
            minutes: minutes.nullable(),
          })
          .strict(),
      )
      .max(20),
    expenses: z
      .array(
        z
          .object({
            id: uuid,
            category: z.enum([
              "fuel",
              "food",
              "toll",
              "parking",
              "wash",
              "other",
            ]),
            label,
            amount_cents: cents,
            liters: z.number().positive().max(999).nullable(),
            odometer_km: z.number().int().min(0).max(9_999_999).nullable(),
            full_tank: z.boolean().nullable(),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();

export type DayPayload = z.infer<typeof dayPayloadSchema>;

export const syncRequestSchema = z
  .object({ days: z.array(dayPayloadSchema).min(1).max(50) })
  .strict();

export type SyncResult =
  | {
      localId: string;
      ok: true;
      id: string;
      applied: boolean;
      client_updated_at: string;
    }
  | { localId: string; ok: false; error: string };
