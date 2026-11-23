-- Km+ — initial schema.
-- Conventions: money in integer cents; hours in integer minutes; km in integer km.
-- Every user table has user_id and Row Level Security (user_id = auth.uid()).
-- Row ids are UUIDs that the client may generate (offline-first upserts).
-- See docs/data-model.md.

-- gen_random_uuid() is built into Postgres 13+; no extension needed.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  city text check (char_length(city) <= 80),
  vehicle_ownership text check (vehicle_ownership in ('own', 'rented', 'financed')),
  fuel_type text check (fuel_type in ('gasoline', 'ethanol', 'flex', 'gnv', 'electric')),
  apps text[] not null default '{}'
    check (cardinality(apps) <= 10),
  monthly_goal_cents integer check (monthly_goal_cents >= 0),
  typical_hours_per_day numeric(4, 2) check (typical_hours_per_day > 0 and typical_hours_per_day <= 24),
  typical_days_per_month smallint check (typical_days_per_month between 1 and 31),
  vehicle_mode_enabled boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create an empty profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- vehicles (v1: at most one per user)
-- ---------------------------------------------------------------------------

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade default auth.uid(),
  brand text check (char_length(brand) <= 40),
  model text check (char_length(model) <= 60),
  year smallint check (year between 1980 and 2100),
  category text check (category in ('compact', 'sedan', 'suv', 'other')),
  km_per_liter numeric(5, 2) check (km_per_liter > 0),
  odometer_km integer check (odometer_km >= 0),
  rent_cents integer check (rent_cents >= 0),
  rent_period text check (rent_period in ('day', 'week', 'month')),
  installment_cents integer check (installment_cents >= 0),
  insurance_year_cents integer check (insurance_year_cents >= 0),
  ipva_year_cents integer check (ipva_year_cents >= 0),
  -- Driver overrides for the per-km reserve (null = use cost_reference).
  maintenance_cents_per_km numeric(8, 2) check (maintenance_cents_per_km >= 0),
  tires_cents_per_km numeric(8, 2) check (tires_cents_per_km >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_rent_pair check ((rent_cents is null) = (rent_period is null))
);

create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- platform_settings: how each app charges the driver
-- ---------------------------------------------------------------------------

create table public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  source text not null check (source in ('uber', '99', 'other')),
  label text check (char_length(label) <= 40),
  mode text not null default 'net_already' check (mode in ('net_already', 'percent', 'pass')),
  percent numeric(5, 2) check (percent >= 0 and percent <= 100),
  pass_cents integer check (pass_cents >= 0),
  pass_period text check (pass_period in ('day', 'week', 'month')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_mode_fields check (
    (mode = 'net_already')
    or (mode = 'percent' and percent is not null)
    or (mode = 'pass' and pass_cents is not null and pass_period is not null)
  )
);

create unique index platform_settings_user_source_label
  on public.platform_settings (user_id, source, coalesce(label, ''));

create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- days, earnings, expenses
-- ---------------------------------------------------------------------------

create table public.days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date date not null,
  minutes integer check (minutes between 0 and 1440),
  km integer check (km between 0 and 3000),
  is_day_off boolean not null default false,
  shifts text[] check (shifts <@ array['morning', 'afternoon', 'evening', 'night']::text[]),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date),
  -- Lets children reference (id, user_id) so a row can never point at another user's day.
  unique (id, user_id)
);

create index days_user_date on public.days (user_id, date desc);

create trigger days_updated_at before update on public.days
  for each row execute function public.set_updated_at();

create table public.earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  day_id uuid not null,
  source text not null check (source in ('uber', '99', 'other')),
  label text check (char_length(label) <= 40),
  amount_cents integer not null check (amount_cents >= 0 and amount_cents <= 10000000),
  minutes integer check (minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (day_id, user_id) references public.days (id, user_id) on delete cascade
);

create index earnings_day on public.earnings (day_id);
create index earnings_user on public.earnings (user_id);

create trigger earnings_updated_at before update on public.earnings
  for each row execute function public.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  day_id uuid not null,
  category text not null check (category in ('fuel', 'food', 'toll', 'parking', 'wash', 'other')),
  label text check (char_length(label) <= 40),
  amount_cents integer not null check (amount_cents >= 0 and amount_cents <= 10000000),
  liters numeric(7, 3) check (liters > 0),
  odometer_km integer check (odometer_km >= 0),
  -- Fuel only: the tank was filled to the top (needed for tank-to-tank km/l).
  full_tank boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (day_id, user_id) references public.days (id, user_id) on delete cascade
);

create index expenses_day on public.expenses (day_id);
create index expenses_user on public.expenses (user_id);

create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- maintenance_items
-- ---------------------------------------------------------------------------

create table public.maintenance_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 60),
  interval_km integer not null check (interval_km > 0),
  last_done_km integer check (last_done_km >= 0),
  last_done_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger maintenance_items_updated_at before update on public.maintenance_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- cost_reference (seed, read-only for users; values are PLACEHOLDERS)
-- ---------------------------------------------------------------------------

create table public.cost_reference (
  id smallserial primary key,
  category text not null check (category in ('compact', 'sedan', 'suv', 'other')),
  age_band text not null check (age_band in ('0-3', '4-7', '8+')),
  maintenance_cents_per_km numeric(8, 2) not null check (maintenance_cents_per_km >= 0),
  tires_cents_per_km numeric(8, 2) not null check (tires_cents_per_km >= 0),
  is_placeholder boolean not null default true,
  source_note text,
  unique (category, age_band)
);

-- ---------------------------------------------------------------------------
-- payments and entitlements (written only by the server with the service role)
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  provider text not null check (provider in ('mercadopago')),
  provider_payment_id text not null,
  status text not null,
  amount_cents integer not null check (amount_cents >= 0),
  paid_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create index payments_user on public.payments (user_id);

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('premium', 'free')),
  source text not null check (source in ('purchase', 'manual')),
  payment_id uuid references public.payments (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now()
);

-- At most one active entitlement per user and plan.
create unique index entitlements_active_unique
  on public.entitlements (user_id, plan) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.platform_settings enable row level security;
alter table public.days enable row level security;
alter table public.earnings enable row level security;
alter table public.expenses enable row level security;
alter table public.maintenance_items enable row level security;
alter table public.cost_reference enable row level security;
alter table public.payments enable row level security;
alter table public.entitlements enable row level security;

-- profiles: the row id is the user id. Insert happens via trigger.
create policy profiles_select on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Owner-only CRUD for the driver's own data.
do $$
declare
  t text;
begin
  foreach t in array array['vehicles', 'platform_settings', 'days', 'earnings', 'expenses', 'maintenance_items']
  loop
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Reference data: readable by any signed-in user, never writable by clients.
create policy cost_reference_select on public.cost_reference
  for select to authenticated using (true);

-- Payments and entitlements: users can only read their own rows.
create policy payments_select on public.payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy entitlements_select on public.entitlements
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants (defence in depth on top of RLS)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on
  public.vehicles, public.platform_settings, public.days, public.earnings,
  public.expenses, public.maintenance_items
  to authenticated;
grant select on public.cost_reference, public.payments, public.entitlements to authenticated;
