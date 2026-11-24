import { z } from "zod";

export const workSettingsSchema = z
  .object({
    apps: z.object({
      uber: z.boolean(),
      n99: z.boolean(),
      others: z.array(z.string().max(40)).max(8),
    }),
    goalCents: z.number().int().min(0).max(100_000_000).nullable(),
    hoursPerDay: z.number().min(0.5).max(20).nullable(),
    daysPerMonth: z.number().int().min(1).max(31).nullable(),
  })
  .strict();

export const platformSettingSchema = z
  .object({
    source: z.enum(["uber", "99", "other"]),
    label: z.string().trim().max(40).nullable(),
    mode: z.enum(["net_already", "percent", "pass"]),
    percent: z.number().min(0).max(100).nullable(),
    passCents: z.number().int().min(0).max(10_000_000).nullable(),
    passPeriod: z.enum(["day", "week", "month"]).nullable(),
  })
  .strict()
  .refine((s) => s.mode !== "percent" || s.percent != null, {
    message: "percent required",
  })
  .refine(
    (s) => s.mode !== "pass" || (s.passCents != null && s.passPeriod != null),
    { message: "pass required" },
  );

export type WorkSettings = z.infer<typeof workSettingsSchema>;
export type PlatformSettingInput = z.infer<typeof platformSettingSchema>;
