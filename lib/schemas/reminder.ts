import { z } from "zod";
import { reminderTimes } from "../push/reminders";

const TIMES = new Set(reminderTimes());

export const reminderInputSchema = z
  .object({
    enabled: z.boolean(),
    time: z.string().refine((t) => TIMES.has(t), "invalid time"),
    subscription: z
      .object({
        endpoint: z.string().url().startsWith("https://").max(1000),
        p256dh: z.string().regex(/^[\w-]{40,200}$/),
        auth: z.string().regex(/^[\w-]{10,100}$/),
      })
      .nullable(),
  })
  .strict()
  .refine((v) => !v.enabled || v.subscription != null, {
    message: "subscription required",
  });

export type ReminderInput = z.infer<typeof reminderInputSchema>;
