// Daily reminder sender (Supabase Edge Function, Deno).
// Called every 15 minutes by pg_cron (db/migrations/0004_reminders_cron.sql)
// with the x-cron-secret header. Notifies drivers whose reminder time is the
// current São Paulo 15-minute slot, once per day, only if the day is not
// closed yet. Deploy with scripts/deploy-reminders.sh, which copies
// lib/push/webpush.ts and lib/push/reminders.ts next to this file.
import { sendPush, type VapidKeys } from "./webpush.ts";
import { isDayClosed, reminderMessage, reminderSlot } from "./reminders.ts";

const URL_BASE = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("KM_SERVICE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const VAPID: VapidKeys = {
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
  subject: "https://kmmais.app.br",
};

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path.split("?")[0]}: HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("not found", { status: 404 });
  if (!sameSecret(req.headers.get("x-cron-secret") ?? "", CRON_SECRET))
    return new Response("forbidden", { status: 401 });

  const url = new URL(req.url);
  const { date, slot } = reminderSlot(new Date());
  const only = url.searchParams.get("slot") ?? slot; // manual tests

  const due = (await rest(
    `profiles?select=id&reminder_enabled=eq.true&reminder_time=eq.${only}:00` +
      `&or=(last_reminder_on.is.null,last_reminder_on.lt.${date})`,
  )) as Array<{ id: string }>;
  if (due.length === 0)
    return Response.json({ date, slot: only, due: 0, sent: 0 });

  const ids = due.map((p) => p.id).join(",");
  const days = (await rest(
    `days?select=user_id,is_day_off,earnings(amount_cents)&date=eq.${date}&user_id=in.(${ids})`,
  )) as Array<{
    user_id: string;
    is_day_off: boolean;
    earnings: Array<{ amount_cents: number }>;
  }>;
  const closed = new Set(days.filter(isDayClosed).map((d) => d.user_id));
  const open = due.filter((p) => !closed.has(p.id)).map((p) => p.id);

  let sent = 0;
  let removed = 0;
  if (open.length > 0) {
    const subs = (await rest(
      `push_subscriptions?select=id,user_id,endpoint,p256dh,auth&user_id=in.(${open.join(",")})`,
    )) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
    const message = reminderMessage(date);
    for (const s of subs) {
      try {
        const r = await sendPush(s, message, VAPID);
        if (r.status >= 200 && r.status < 300) sent++;
        if (r.gone) {
          await rest(`push_subscriptions?id=eq.${s.id}`, { method: "DELETE" });
          removed++;
        }
      } catch (e) {
        console.error("push failed", (e as Error).message);
      }
    }
  }

  // Once per day, also for drivers who had already closed the day.
  await rest(`profiles?id=in.(${ids})`, {
    method: "PATCH",
    body: JSON.stringify({ last_reminder_on: date }),
    headers: { Prefer: "return=minimal" },
  });

  return Response.json({
    date,
    slot: only,
    due: due.length,
    open: open.length,
    sent,
    removed,
  });
});
