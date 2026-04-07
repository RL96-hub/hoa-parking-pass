create extension if not exists pgcrypto;

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  name text
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  number text not null,
  access_code text not null,
  free_pass_limit integer not null default 12,
  party_days text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (building_id, number)
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  price_per_pass numeric(10,2) not null default 5.00,
  party_pass_limit integer not null default 3,
  admin_password text not null default 'admin123',
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  license_plate text not null,
  make text not null,
  model text not null,
  color text not null,
  nickname text,
  created_at timestamptz not null default now(),
  unique (unit_id, license_plate)
);

create table if not exists public.passes (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  vehicle_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  type text not null check (type in ('free','paid','party')),
  payment_status text not null check (payment_status in ('free','paid','payment_required','waived')),
  price numeric(10,2)
);

create index if not exists idx_units_building_id on public.units(building_id);
create index if not exists idx_vehicles_unit_id on public.vehicles(unit_id);
create index if not exists idx_passes_unit_id on public.passes(unit_id);
create index if not exists idx_passes_vehicle_id on public.passes(vehicle_id);
create index if not exists idx_passes_expires_at on public.passes(expires_at);

alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.settings enable row level security;
alter table public.vehicles enable row level security;
alter table public.passes enable row level security;

drop policy if exists "dev_all_buildings" on public.buildings;
create policy "dev_all_buildings" on public.buildings for all using (true) with check (true);

drop policy if exists "dev_all_units" on public.units;
create policy "dev_all_units" on public.units for all using (true) with check (true);

drop policy if exists "dev_all_settings" on public.settings;
create policy "dev_all_settings" on public.settings for all using (true) with check (true);

drop policy if exists "dev_all_vehicles" on public.vehicles;
create policy "dev_all_vehicles" on public.vehicles for all using (true) with check (true);

drop policy if exists "dev_all_passes" on public.passes;
create policy "dev_all_passes" on public.passes for all using (true) with check (true);

insert into public.settings (price_per_pass, party_pass_limit, admin_password)
select 5.00, 3, 'admin123'
where not exists (select 1 from public.settings);

insert into public.buildings (number, name)
select '1', 'Building 1'
where not exists (select 1 from public.buildings where number = '1');

insert into public.units (building_id, number, access_code, free_pass_limit, party_days)
select b.id, '101', '1234', 12, '{}'
from public.buildings b
where b.number = '1'
and not exists (
  select 1 from public.units u
  where u.building_id = b.id and u.number = '101'
);
