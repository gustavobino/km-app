-- Schedules the daily-reminder Edge Function every 15 minutes (pg_cron + pg_net).
-- Not a regular migration: these extensions do not exist in the test database.
-- Needs the vault secret 'reminders_cron_secret' (same value as the function's
-- CRON_SECRET), created once with:
--   select vault.create_secret('<value>', 'reminders_cron_secret');
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule('send-reminders')
where exists (select 1 from cron.job where jobname = 'send-reminders');

select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://bguifsyabtcvinzaajcy.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
