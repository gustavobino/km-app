-- Km+ — offline sync for days.
-- The app saves a whole day (day + earnings + expenses) locally and later
-- sends it here. save_day() writes it atomically, idempotently, and applies
-- "last edit wins" using the time the edit was made on the device.

alter table public.days
  add column client_updated_at timestamptz not null default now();

create index days_user_updated on public.days (user_id, updated_at);

-- Payload (jsonb):
-- {
--   "id": uuid, "date": "YYYY-MM-DD", "minutes": int|null, "km": int|null,
--   "is_day_off": bool, "shifts": text[]|null, "note": text|null,
--   "client_updated_at": timestamptz,
--   "earnings": [{ "id", "source", "label", "amount_cents", "minutes" }],
--   "expenses": [{ "id", "category", "label", "amount_cents", "liters", "odometer_km", "full_tank" }]
-- }
-- Returns { "id": uuid of the stored day, "applied": bool, "client_updated_at": timestamptz }.
-- "id" can differ from the payload when the same date already existed under
-- another id (e.g. registered on another phone): the existing row is kept.
create or replace function public.save_day(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_date date := (payload ->> 'date')::date;
  v_client_ts timestamptz := (payload ->> 'client_updated_at')::timestamptz;
  v_id uuid;
  v_existing_ts timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_date is null or v_client_ts is null or (payload ->> 'id') is null then
    raise exception 'invalid payload' using errcode = '22023';
  end if;

  select d.id, d.client_updated_at into v_id, v_existing_ts
  from public.days d
  where d.user_id = uid and d.date = v_date
  for update;

  if found and v_existing_ts >= v_client_ts then
    -- The stored version is the same or newer: nothing to do (idempotent).
    return jsonb_build_object('id', v_id, 'applied', false, 'client_updated_at', v_existing_ts);
  end if;

  if found then
    update public.days set
      minutes = (payload ->> 'minutes')::int,
      km = (payload ->> 'km')::int,
      is_day_off = coalesce((payload ->> 'is_day_off')::boolean, false),
      shifts = case when payload -> 'shifts' is null or jsonb_typeof(payload -> 'shifts') = 'null' then null
               else array(select jsonb_array_elements_text(payload -> 'shifts')) end,
      note = payload ->> 'note',
      client_updated_at = v_client_ts
    where id = v_id;
  else
    v_id := (payload ->> 'id')::uuid;
    insert into public.days (id, user_id, date, minutes, km, is_day_off, shifts, note, client_updated_at)
    values (
      v_id, uid, v_date,
      (payload ->> 'minutes')::int,
      (payload ->> 'km')::int,
      coalesce((payload ->> 'is_day_off')::boolean, false),
      case when payload -> 'shifts' is null or jsonb_typeof(payload -> 'shifts') = 'null' then null
           else array(select jsonb_array_elements_text(payload -> 'shifts')) end,
      payload ->> 'note',
      v_client_ts
    );
  end if;

  delete from public.earnings where day_id = v_id;
  insert into public.earnings (id, user_id, day_id, source, label, amount_cents, minutes)
  select
    coalesce((e ->> 'id')::uuid, gen_random_uuid()), uid, v_id,
    e ->> 'source', e ->> 'label', (e ->> 'amount_cents')::int, (e ->> 'minutes')::int
  from jsonb_array_elements(coalesce(payload -> 'earnings', '[]'::jsonb)) as e;

  delete from public.expenses where day_id = v_id;
  insert into public.expenses (id, user_id, day_id, category, label, amount_cents, liters, odometer_km, full_tank)
  select
    coalesce((x ->> 'id')::uuid, gen_random_uuid()), uid, v_id,
    x ->> 'category', x ->> 'label', (x ->> 'amount_cents')::int,
    (x ->> 'liters')::numeric, (x ->> 'odometer_km')::int, (x ->> 'full_tank')::boolean
  from jsonb_array_elements(coalesce(payload -> 'expenses', '[]'::jsonb)) as x;

  return jsonb_build_object('id', v_id, 'applied', true, 'client_updated_at', v_client_ts);
end;
$$;

revoke all on function public.save_day(jsonb) from public, anon;
grant execute on function public.save_day(jsonb) to authenticated;
