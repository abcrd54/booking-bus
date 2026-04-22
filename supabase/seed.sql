-- Dummy data for local/staging Supabase.
-- Run this after schema.sql.

insert into public.routes (route_code, origin_city, destination_city, origin_point, destination_point, service_type, duration_minutes, distance_km, is_active)
values
  ('JKT-YGY', 'Jakarta', 'Yogyakarta', 'Terminal Kampung Rambutan', 'Terminal Giwangan', 'bus', 510, 560, true),
  ('BDG-JKT', 'Bandung', 'Jakarta', 'Terminal Leuwipanjang', 'Terminal Kampung Rambutan', 'bus', 190, 150, true),
  ('SMG-SBY', 'Semarang', 'Surabaya', 'Terminal Mangkang', 'Terminal Purabaya', 'bus', 340, 350, true),
  ('JKT-SMG', 'Jakarta', 'Semarang', 'Terminal Pulo Gebang', 'Terminal Mangkang', 'bus', 410, 455, true),
  ('YGY-MLG', 'Yogyakarta', 'Malang', 'Terminal Giwangan', 'Terminal Arjosari', 'travel', 390, 365, true)
on conflict (route_code) do update set
  origin_city = excluded.origin_city,
  destination_city = excluded.destination_city,
  origin_point = excluded.origin_point,
  destination_point = excluded.destination_point,
  service_type = excluded.service_type,
  duration_minutes = excluded.duration_minutes,
  distance_km = excluded.distance_km,
  is_active = excluded.is_active;

insert into public.armadas (
  armada_code,
  name,
  plate_number,
  service_type,
  class_type,
  seat_configuration,
  estimated_seat_range,
  toilet_location,
  seat_capacity,
  seat_layout_template,
  facilities,
  is_active
)
values
  ('MJ-09', 'Maju Jaya 09', 'B 1028 MJ', 'bus', 'Eksekutif', '2 - 2', '32 - 45 Seat', 'Belakang / Tengah', 39, '2-2 eksekutif 39 seats', '["AC", "Reclining seat", "USB charger", "GPS tracking"]'::jsonb, true),
  ('MJ-12', 'Maju Jaya 12', 'B 2041 MJ', 'bus', 'Super Eksekutif', '2 - 1', '21 - 24 Seat', 'Belakang', 24, '2-1 super eksekutif', '["AC", "Leg rest", "USB charger", "Snack"]'::jsonb, true),
  ('MJ-21', 'Maju Jaya 21', 'H 3180 MJ', 'bus', 'Sleeper / Suites', '1 - 1', '18 - 22 Seat', 'Belakang / Tengah', 20, '1-1 sleeper suites', '["AC", "Toilet", "USB charger", "Entertainment"]'::jsonb, true),
  ('MJ-27', 'Maju Jaya 27', 'AB 2701 MJ', 'bus', 'Double Decker', 'Variasi (1-1 & 2-2)', '50 - 70 Seat (Total)', 'Dek Bawah', 60, 'double decker mixed', '["AC", "Blanket", "USB charger", "GPS tracking"]'::jsonb, true),
  ('TRV-01', 'Maju Jaya Travel 01', 'B 7101 MJ', 'travel', 'HiAce Executive', '1 - 1', '8 - 12 Seat', '-', 10, 'travel 1-1', '["AC", "Captain seat", "USB charger"]'::jsonb, true)
on conflict (armada_code) do update set
  name = excluded.name,
  plate_number = excluded.plate_number,
  service_type = excluded.service_type,
  class_type = excluded.class_type,
  seat_configuration = excluded.seat_configuration,
  estimated_seat_range = excluded.estimated_seat_range,
  toilet_location = excluded.toilet_location,
  seat_capacity = excluded.seat_capacity,
  seat_layout_template = excluded.seat_layout_template,
  facilities = excluded.facilities,
  is_active = excluded.is_active;

insert into public.vouchers (
  code,
  name,
  description,
  discount_type,
  discount_value,
  max_discount,
  min_order_amount,
  quota,
  valid_from,
  valid_until,
  service_type,
  terms,
  is_active
)
values
  ('HEMAT25', 'Diskon 25%', 'Potongan 25% untuk rute bus pilihan.', 'percent', 25, 50000, 200000, 100, now() - interval '1 day', now() + interval '60 days', 'bus', 'Berlaku untuk layanan bus. Minimal transaksi Rp200.000. Maksimal potongan Rp50.000. Tidak dapat digabung dengan promo lain.', true),
  ('TRAVEL10K', 'Diskon Travel Rp10.000', 'Potongan langsung untuk layanan travel.', 'fixed', 10000, null, 50000, 200, now() - interval '1 day', now() + interval '60 days', 'travel', 'Berlaku untuk layanan travel. Minimal transaksi Rp50.000. Tidak dapat digabung dengan promo lain.', true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  max_discount = excluded.max_discount,
  min_order_amount = excluded.min_order_amount,
  quota = excluded.quota,
  valid_from = excluded.valid_from,
  valid_until = excluded.valid_until,
  service_type = excluded.service_type,
  terms = excluded.terms,
  is_active = excluded.is_active;

delete from public.armada_seat_templates ast
using public.armadas a
where ast.armada_id = a.id
  and a.armada_code in ('MJ-09', 'MJ-12', 'MJ-21', 'MJ-27', 'TRV-01');

-- Eksekutif 2-2: 34 kursi utama dengan lorong tengah, 5 kursi belakang.
insert into public.armada_seat_templates (armada_id, seat_number, seat_row, seat_col, seat_type)
select
  a.id,
  seat_no::text,
  case
    when seat_no <= 32 then ((seat_no - 1) / 4) + 1
    when seat_no <= 34 then 9
    else 10
  end,
  case
    when seat_no <= 32 then (array[1, 2, 4, 5])[(seat_no - 1) % 4 + 1]
    when seat_no <= 34 then (array[4, 5])[(seat_no - 33) + 1]
    else seat_no - 34
  end,
  'regular'
from public.armadas a
cross join generate_series(1, 39) seat_no
where a.armada_code = 'MJ-09'
on conflict (armada_id, seat_number) do nothing;

-- Super Eksekutif 2-1: dua kursi kiri, lorong, satu kursi kanan.
insert into public.armada_seat_templates (armada_id, seat_number, seat_row, seat_col, seat_type)
select
  a.id,
  seat_no::text,
  ((seat_no - 1) / 3) + 1,
  (array[1, 2, 4])[(seat_no - 1) % 3 + 1],
  'regular'
from public.armadas a
cross join generate_series(1, 24) seat_no
where a.armada_code = 'MJ-12'
on conflict (armada_id, seat_number) do nothing;

-- Sleeper / Suites 1-1: satu kursi di tiap sisi lorong.
insert into public.armada_seat_templates (armada_id, seat_number, seat_row, seat_col, seat_type)
select
  a.id,
  seat_no::text,
  ((seat_no - 1) / 2) + 1,
  (array[1, 3])[(seat_no - 1) % 2 + 1],
  'regular'
from public.armadas a
cross join generate_series(1, 20) seat_no
where a.armada_code = 'MJ-21'
on conflict (armada_id, seat_number) do nothing;

-- Double Decker dek bawah 1-1: toilet berada di dek bawah.
insert into public.armada_seat_templates (armada_id, seat_number, seat_row, seat_col, deck, seat_type)
select
  a.id,
  seat_no::text,
  ((seat_no - 1) / 2) + 1,
  (array[1, 3])[(seat_no - 1) % 2 + 1],
  1,
  'regular'
from public.armadas a
cross join generate_series(1, 12) seat_no
where a.armada_code = 'MJ-27'
on conflict (armada_id, seat_number) do nothing;

-- Double Decker dek atas 2-2.
insert into public.armada_seat_templates (armada_id, seat_number, seat_row, seat_col, deck, seat_type)
select
  a.id,
  seat_no::text,
  ((seat_no - 13) / 4) + 1,
  (array[1, 2, 4, 5])[(seat_no - 13) % 4 + 1],
  2,
  'regular'
from public.armadas a
cross join generate_series(13, 60) seat_no
where a.armada_code = 'MJ-27'
on conflict (armada_id, seat_number) do nothing;

insert into public.armada_seat_templates (armada_id, seat_number, seat_row, seat_col, seat_type)
select a.id, concat('T', row_no), row_no, 1, 'regular'
from public.armadas a
cross join generate_series(1, 10) row_no
where a.armada_code = 'TRV-01'
on conflict (armada_id, seat_number) do nothing;

insert into public.schedule_templates (
  route_id,
  template_code,
  name,
  schedule_type,
  departure_time,
  arrival_time,
  default_price,
  valid_from,
  valid_until,
  is_active
)
select r.id, 'TPL-JKT-YGY-0730', 'Jakarta Yogyakarta Daily 07:30', 'daily', '07:30', '16:00', 250000, current_date, current_date + interval '90 days', true
from public.routes r
where r.route_code = 'JKT-YGY'
on conflict (template_code) do update set
  route_id = excluded.route_id,
  name = excluded.name,
  schedule_type = excluded.schedule_type,
  departure_time = excluded.departure_time,
  arrival_time = excluded.arrival_time,
  default_price = excluded.default_price,
  valid_from = excluded.valid_from,
  valid_until = excluded.valid_until,
  is_active = excluded.is_active;

insert into public.schedule_templates (
  route_id,
  template_code,
  name,
  schedule_type,
  departure_time,
  arrival_time,
  default_price,
  valid_from,
  valid_until,
  is_active
)
select r.id, 'TPL-YGY-MLG-0900', 'Yogyakarta Malang Travel 09:00', 'daily', '09:00', '15:30', 180000, current_date, current_date + interval '90 days', true
from public.routes r
where r.route_code = 'YGY-MLG'
on conflict (template_code) do update set
  route_id = excluded.route_id,
  name = excluded.name,
  schedule_type = excluded.schedule_type,
  departure_time = excluded.departure_time,
  arrival_time = excluded.arrival_time,
  default_price = excluded.default_price,
  valid_from = excluded.valid_from,
  valid_until = excluded.valid_until,
  is_active = excluded.is_active;

-- Recreate seeded trips without bookings so seat layout changes are cloned again.
delete from public.trips t
using public.routes r, public.armadas a
where t.route_id = r.id
  and t.armada_id = a.id
  and r.route_code in ('JKT-YGY', 'BDG-JKT', 'SMG-SBY', 'JKT-SMG')
  and a.armada_code in ('MJ-09', 'MJ-12', 'MJ-21', 'MJ-27')
  and not exists (
    select 1
    from public.bookings b
    where b.trip_id = t.id
  );

insert into public.trips (schedule_template_id, route_id, armada_id, departure_datetime, arrival_datetime, price, status)
select st.id, r.id, a.id, date_trunc('day', now() + interval '1 day') + interval '7 hours 30 minutes', date_trunc('day', now() + interval '1 day') + interval '16 hours', 250000, 'scheduled'
from public.routes r, public.armadas a, public.schedule_templates st
where r.route_code = 'JKT-YGY' and a.armada_code = 'MJ-09' and st.template_code = 'TPL-JKT-YGY-0730'
on conflict (route_id, armada_id, departure_datetime) do nothing;

insert into public.trips (route_id, armada_id, departure_datetime, arrival_datetime, price, status)
select r.id, a.id, date_trunc('day', now() + interval '1 day') + interval '10 hours 15 minutes', date_trunc('day', now() + interval '1 day') + interval '13 hours 25 minutes', 120000, 'scheduled'
from public.routes r, public.armadas a
where r.route_code = 'BDG-JKT' and a.armada_code = 'MJ-12'
on conflict (route_id, armada_id, departure_datetime) do nothing;

insert into public.trips (route_id, armada_id, departure_datetime, arrival_datetime, price, status)
select r.id, a.id, date_trunc('day', now() + interval '1 day') + interval '19 hours', date_trunc('day', now() + interval '2 day') + interval '40 minutes', 310000, 'scheduled'
from public.routes r, public.armadas a
where r.route_code = 'SMG-SBY' and a.armada_code = 'MJ-21'
on conflict (route_id, armada_id, departure_datetime) do nothing;

insert into public.trips (route_id, armada_id, departure_datetime, arrival_datetime, price, status)
select r.id, a.id, date_trunc('day', now() + interval '2 day') + interval '8 hours', date_trunc('day', now() + interval '2 day') + interval '14 hours 50 minutes', 220000, 'scheduled'
from public.routes r, public.armadas a
where r.route_code = 'JKT-SMG' and a.armada_code = 'MJ-27'
on conflict (route_id, armada_id, departure_datetime) do nothing;

-- Simulate current occupancy after trip seat clone trigger has generated seats.
with target_trip as (
  select t.id
  from public.trips t
  join public.routes r on r.id = t.route_id
  where r.route_code = 'JKT-YGY'
  order by t.departure_datetime
  limit 1
),
ranked_seats as (
  select ts.id, row_number() over (order by ts.seat_row, ts.seat_col) as rn
  from public.trip_seats ts
  join target_trip tt on tt.id = ts.trip_id
)
update public.trip_seats ts
set status = case
    when rs.rn in (1, 2, 6, 10) then 'booked'::public.seat_status
    when rs.rn in (4, 11) then 'locked'::public.seat_status
    else 'available'::public.seat_status
  end,
  locked_until = case when rs.rn in (4, 11) then now() + interval '10 minutes' else null end
from ranked_seats rs
where rs.id = ts.id;

-- Mark one seeded trip as fully booked so the website can show the Full Booked badge.
with full_trip as (
  select t.id
  from public.trips t
  join public.routes r on r.id = t.route_id
  where r.route_code = 'BDG-JKT'
  order by t.departure_datetime
  limit 1
)
update public.trip_seats ts
set status = 'booked'::public.seat_status,
    locked_until = null
from full_trip ft
where ft.id = ts.trip_id;
