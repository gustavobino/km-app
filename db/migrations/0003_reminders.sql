-- Daily reminder to close the day (web push).
-- The driver picks a time (São Paulo, 15-minute steps). A Supabase Edge
-- Function (supabase/functions/send-reminders) runs every 15 minutes via
-- pg_cron and notifies whoever chose that time and has not closed the day yet.

alter table public.profiles
  add column reminder_enabled boolean not null default false,
  add column reminder_time time check (extract(minute from reminder_time)::int % 15 = 0 and extract(second from reminder_time) = 0),
  add column last_reminder_on date;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  endpoint text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Same as 0001: no default privileges; only what the app needs.
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
