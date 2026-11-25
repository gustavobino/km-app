/**
 * Daily reminder rules (pure, no imports: also deployed with the Supabase
 * Edge Function supabase/functions/send-reminders).
 */

export const REMINDER_TIMEZONE = "America/Sao_Paulo";
export const REMINDER_STEP_MINUTES = 15;

/** São Paulo local date and the 15-minute slot ("20:30") of an instant. */
export function reminderSlot(now: Date): { date: string; slot: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: REMINDER_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const minute =
    Math.floor(Number(parts.minute) / REMINDER_STEP_MINUTES) *
    REMINDER_STEP_MINUTES;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    slot: `${parts.hour}:${String(minute).padStart(2, "0")}`,
  };
}

/** Times offered in the settings: 06:00 to 23:45 every 15 minutes. */
export function reminderTimes(): string[] {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++)
    for (let m = 0; m < 60; m += REMINDER_STEP_MINUTES)
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  return out;
}

/** A day counts as closed when it has an earning or is marked as day off. */
export function isDayClosed(
  day: {
    is_day_off: boolean;
    earnings: Array<{ amount_cents: number }>;
  } | null,
): boolean {
  return Boolean(
    day && (day.is_day_off || day.earnings.some((e) => e.amount_cents > 0)),
  );
}

const BODIES = [
  "Fechou o dia? Registrar leva 20 segundos.",
  "Como foi hoje? Registre e veja quanto sobrou no bolso.",
  "Bora fechar o dia? É rapidinho.",
];

/** The notification (one short line, positive tone). Varies with the date. */
export function reminderMessage(date: string): {
  title: string;
  body: string;
  url: string;
} {
  const n = Number(date.slice(8, 10));
  return { title: "Km+", body: BODIES[n % BODIES.length]!, url: "/registrar" };
}
