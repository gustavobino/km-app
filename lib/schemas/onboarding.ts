import { z } from "zod";

const cents = z.number().int().min(0).max(100_000_000);

/** Server-side validation of what the onboarding screen sends. */
export const onboardingAnswersSchema = z
  .object({
    apps: z
      .object({
        uber: z.boolean(),
        n99: z.boolean(),
        others: z.array(z.string().max(40)).max(8),
      })
      .optional(),
    ownership: z.enum(["own", "rented", "financed"]).optional(),
    rent: z
      .object({ cents, period: z.enum(["day", "week", "month"]) })
      .optional(),
    installmentCents: cents.optional(),
    fuel: z.enum(["gasoline", "ethanol", "flex", "gnv", "electric"]).optional(),
    goalCents: cents.optional(),
    daysPerWeek: z.number().int().min(1).max(7).optional(),
    hoursPerDay: z
      .number()
      .int()
      .min(30)
      .max(20 * 60)
      .optional(),
  })
  .strict();

export type OnboardingAnswersInput = z.infer<typeof onboardingAnswersSchema>;
