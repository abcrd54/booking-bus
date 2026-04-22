create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('admin', 'user');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.trip_status as enum ('scheduled', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.seat_status as enum ('available', 'locked', 'booked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_status as enum ('pending_payment', 'paid', 'cancelled', 'expired');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'settlement', 'expire', 'cancel', 'deny');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.service_type as enum ('bus', 'travel');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.schedule_type as enum ('daily', 'custom');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  address text,
  phone text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  route_code text not null unique,
  origin_city text not null,
  destination_city text not null,
  origin_point text not null,
  destination_point text not null,
  service_type public.service_type not null default 'bus',
  duration_minutes integer not null,
  distance_km numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.routes
  add column if not exists service_type public.service_type not null default 'bus';

create table if not exists public.armadas (
  id uuid primary key default gen_random_uuid(),
  armada_code text not null unique,
  name text not null,
  plate_number text not null,
  service_type public.service_type not null default 'bus',
  class_type text not null,
  seat_configuration text,
  estimated_seat_range text,
  toilet_location text,
  seat_capacity integer not null,
  seat_layout_template text not null,
  facilities jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.armadas
  add column if not exists service_type public.service_type not null default 'bus';

alter table public.armadas
  add column if not exists seat_configuration text,
  add column if not exists estimated_seat_range text,
  add column if not exists toilet_location text;

create table if not exists public.armada_seat_templates (
  id uuid primary key default gen_random_uuid(),
  armada_id uuid not null references public.armadas(id) on delete cascade,
  seat_number text not null,
  seat_row integer not null,
  seat_col integer not null,
  deck integer not null default 1,
  seat_type text not null default 'regular',
  unique (armada_id, seat_number)
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  schedule_template_id uuid,
  route_id uuid not null references public.routes(id) on delete restrict,
  armada_id uuid not null references public.armadas(id) on delete restrict,
  departure_datetime timestamptz not null,
  arrival_datetime timestamptz not null,
  price numeric not null,
  status public.trip_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  unique (route_id, armada_id, departure_datetime)
);

alter table public.trips
  add column if not exists schedule_template_id uuid;

create table if not exists public.schedule_templates (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  template_code text not null unique,
  name text not null,
  schedule_type public.schedule_type not null default 'daily',
  departure_time time not null,
  arrival_time time not null,
  default_price numeric not null,
  valid_from date,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.trips
    add constraint trips_schedule_template_id_fkey
    foreign key (schedule_template_id) references public.schedule_templates(id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists public.schedule_blackout_dates (
  id uuid primary key default gen_random_uuid(),
  schedule_template_id uuid not null references public.schedule_templates(id) on delete cascade,
  blackout_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (schedule_template_id, blackout_date)
);

create table if not exists public.trip_seats (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  seat_number text not null,
  seat_row integer not null,
  seat_col integer not null,
  deck integer not null default 1,
  seat_type text not null default 'regular',
  status public.seat_status not null default 'available',
  locked_until timestamptz,
  booking_id uuid,
  unique (trip_id, seat_number)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique default ('BK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  user_id uuid not null references public.profiles(id) on delete restrict,
  trip_id uuid not null references public.trips(id) on delete restrict,
  total_amount numeric not null,
  booking_status public.booking_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'pending',
  midtrans_order_id text,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.trip_seats
    add constraint trip_seats_booking_id_fkey
    foreign key (booking_id) references public.bookings(id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists public.booking_seats (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  trip_seat_id uuid not null references public.trip_seats(id) on delete restrict,
  price numeric not null,
  unique (booking_id, trip_seat_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider text not null default 'midtrans',
  transaction_id text,
  order_id text,
  gross_amount numeric not null,
  transaction_status text,
  fraud_status text,
  payment_type text,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric not null check (discount_value > 0),
  max_discount numeric check (max_discount is null or max_discount > 0),
  min_order_amount numeric not null default 0 check (min_order_amount >= 0),
  quota integer check (quota is null or quota > 0),
  used_count integer not null default 0 check (used_count >= 0),
  valid_from timestamptz,
  valid_until timestamptz,
  service_type public.service_type,
  terms text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, phone, address, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'address', ''),
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

create or replace function public.clone_trip_seats_from_armada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_seats (trip_id, seat_number, seat_row, seat_col, deck, seat_type)
  select new.id, seat_number, seat_row, seat_col, deck, seat_type
  from public.armada_seat_templates
  where armada_id = new.armada_id;

  return new;
end;
$$;

drop trigger if exists on_trip_created_clone_seats on public.trips;
create trigger on_trip_created_clone_seats
  after insert on public.trips
  for each row execute function public.clone_trip_seats_from_armada();

create or replace function public.create_booking_with_seat_lock(
  p_user_id uuid,
  p_trip_id uuid,
  p_seat_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips%rowtype;
  v_booking public.bookings%rowtype;
  v_locked_count integer;
  v_total numeric;
begin
  if array_length(p_seat_ids, 1) is null then
    raise exception 'At least one seat is required';
  end if;

  select * into v_trip
  from public.trips
  where id = p_trip_id and status = 'scheduled'
  for update;

  if not found then
    raise exception 'Trip is not available';
  end if;

  perform 1
  from public.trip_seats
  where id = any(p_seat_ids)
    and trip_id = p_trip_id
  for update;

  perform 1
  from public.trip_seats
  where id = any(p_seat_ids)
    and trip_id = p_trip_id
    and (status = 'booked' or (status = 'locked' and locked_until > now()));

  if found then
    raise exception 'One or more seats are no longer available';
  end if;

  select count(*) into v_locked_count
  from public.trip_seats
  where id = any(p_seat_ids)
    and trip_id = p_trip_id;

  if v_locked_count <> array_length(p_seat_ids, 1) then
    raise exception 'Seat selection is invalid for this trip';
  end if;

  v_total := v_trip.price * v_locked_count;

  insert into public.bookings (user_id, trip_id, total_amount)
  values (p_user_id, p_trip_id, v_total)
  returning * into v_booking;

  update public.trip_seats
  set status = 'locked',
      locked_until = now() + interval '10 minutes',
      booking_id = v_booking.id
  where id = any(p_seat_ids)
    and trip_id = p_trip_id;

  insert into public.booking_seats (booking_id, trip_seat_id, price)
  select v_booking.id, id, v_trip.price
  from public.trip_seats
  where id = any(p_seat_ids)
    and trip_id = p_trip_id;

  return jsonb_build_object(
    'id', v_booking.id,
    'booking_code', v_booking.booking_code,
    'total_amount', v_booking.total_amount,
    'booking_status', v_booking.booking_status,
    'payment_status', v_booking.payment_status,
    'locked_until', now() + interval '10 minutes'
  );
end;
$$;

create or replace function public.release_expired_seat_locks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.trip_seats
  set status = 'available',
      locked_until = null,
      booking_id = null
  where status = 'locked'
    and locked_until <= now();

  get diagnostics v_count = row_count;

  update public.bookings
  set booking_status = 'expired',
      payment_status = 'expire'
  where booking_status = 'pending_payment'
    and id not in (
      select distinct booking_id
      from public.trip_seats
      where booking_id is not null
    );

  return v_count;
end;
$$;

create or replace function public.generate_trips_manual(
  p_schedule_template_id uuid,
  p_service_date date,
  p_armada_ids uuid[],
  p_price_override numeric default null,
  p_departure_time_override time default null,
  p_arrival_time_override time default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.schedule_templates%rowtype;
  v_armada_id uuid;
  v_departure_time time;
  v_arrival_time time;
  v_price numeric;
  v_departure_datetime timestamptz;
  v_arrival_datetime timestamptz;
  v_created integer := 0;
  v_skipped integer := 0;
begin
  if array_length(p_armada_ids, 1) is null then
    raise exception 'At least one armada is required';
  end if;

  select * into v_template
  from public.schedule_templates
  where id = p_schedule_template_id
    and is_active = true;

  if not found then
    raise exception 'Schedule template is not active or not found';
  end if;

  if v_template.valid_from is not null and p_service_date < v_template.valid_from then
    raise exception 'Service date is before template valid_from';
  end if;

  if v_template.valid_until is not null and p_service_date > v_template.valid_until then
    raise exception 'Service date is after template valid_until';
  end if;

  if exists (
    select 1
    from public.schedule_blackout_dates
    where schedule_template_id = p_schedule_template_id
      and blackout_date = p_service_date
  ) then
    return jsonb_build_object('created', 0, 'skipped', array_length(p_armada_ids, 1), 'reason', 'blackout_date');
  end if;

  v_departure_time := coalesce(p_departure_time_override, v_template.departure_time);
  v_arrival_time := coalesce(p_arrival_time_override, v_template.arrival_time);
  v_price := coalesce(p_price_override, v_template.default_price);
  v_departure_datetime := p_service_date + v_departure_time;
  v_arrival_datetime := p_service_date + v_arrival_time;

  if v_arrival_datetime <= v_departure_datetime then
    v_arrival_datetime := v_arrival_datetime + interval '1 day';
  end if;

  foreach v_armada_id in array p_armada_ids loop
    if exists (
      select 1
      from public.trips
      where armada_id = v_armada_id
        and status = 'scheduled'
        and tstzrange(departure_datetime, arrival_datetime, '[)') &&
            tstzrange(v_departure_datetime, v_arrival_datetime, '[)')
    ) then
      v_skipped := v_skipped + 1;
    else
      insert into public.trips (
        schedule_template_id,
        route_id,
        armada_id,
        departure_datetime,
        arrival_datetime,
        price,
        status
      )
      values (
        v_template.id,
        v_template.route_id,
        v_armada_id,
        v_departure_datetime,
        v_arrival_datetime,
        v_price,
        'scheduled'
      )
      on conflict (route_id, armada_id, departure_datetime) do nothing;

      if found then
        v_created := v_created + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end;
$$;

alter table public.profiles enable row level security;
alter table public.routes enable row level security;
alter table public.armadas enable row level security;
alter table public.armada_seat_templates enable row level security;
alter table public.schedule_templates enable row level security;
alter table public.schedule_blackout_dates enable row level security;
alter table public.trips enable row level security;
alter table public.trip_seats enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_seats enable row level security;
alter table public.payments enable row level security;
alter table public.vouchers enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "profiles_read_own_or_admin" on public.profiles;
create policy "profiles_read_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'user');

drop policy if exists "public_read_active_routes" on public.routes;
create policy "public_read_active_routes"
  on public.routes for select
  using (is_active = true or public.is_admin());

drop policy if exists "public_read_active_armadas" on public.armadas;
create policy "public_read_active_armadas"
  on public.armadas for select
  using (is_active = true or public.is_admin());

drop policy if exists "public_read_scheduled_trips" on public.trips;
create policy "public_read_scheduled_trips"
  on public.trips for select
  using (status = 'scheduled' or public.is_admin());

drop policy if exists "public_read_trip_seats" on public.trip_seats;
create policy "public_read_trip_seats"
  on public.trip_seats for select
  using (true);

drop policy if exists "users_read_own_bookings" on public.bookings;
create policy "users_read_own_bookings"
  on public.bookings for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "users_read_own_booking_seats" on public.booking_seats;
create policy "users_read_own_booking_seats"
  on public.booking_seats for select
  using (
    exists (
      select 1 from public.bookings
      where bookings.id = booking_seats.booking_id
        and (bookings.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "admins_manage_routes" on public.routes;
create policy "admins_manage_routes" on public.routes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins_manage_armadas" on public.armadas;
create policy "admins_manage_armadas" on public.armadas for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins_manage_templates" on public.armada_seat_templates;
create policy "admins_manage_templates" on public.armada_seat_templates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins_manage_schedule_templates" on public.schedule_templates;
create policy "admins_manage_schedule_templates" on public.schedule_templates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins_manage_schedule_blackouts" on public.schedule_blackout_dates;
create policy "admins_manage_schedule_blackouts" on public.schedule_blackout_dates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins_manage_trips" on public.trips;
create policy "admins_manage_trips" on public.trips for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins_manage_trip_seats" on public.trip_seats;
create policy "admins_manage_trip_seats" on public.trip_seats for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins_read_payments" on public.payments;
create policy "admins_read_payments" on public.payments for select using (public.is_admin());

drop policy if exists "public_read_active_vouchers" on public.vouchers;
create policy "public_read_active_vouchers"
  on public.vouchers for select
  using (is_active = true);

drop policy if exists "admins_manage_vouchers" on public.vouchers;
create policy "admins_manage_vouchers" on public.vouchers for all using (public.is_admin()) with check (public.is_admin());
