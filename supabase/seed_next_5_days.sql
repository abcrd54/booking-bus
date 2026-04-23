-- Seed refresh untuk 5 hari ke depan (armada + rute + trip).
-- Jalankan setelah schema.sql.
-- Aman di-run ulang karena memakai upsert dan pembersihan trip tanpa booking.

begin;

-- 1) Master rute
insert into public.routes (
  route_code,
  origin_city,
  destination_city,
  origin_point,
  destination_point,
  service_type,
  duration_minutes,
  distance_km,
  is_active
)
values
  ('JKT-YGY', 'Jakarta', 'Yogyakarta', 'Terminal Kampung Rambutan', 'Terminal Giwangan', 'bus', 510, 560, true),
  ('JKT-SMG', 'Jakarta', 'Semarang', 'Terminal Pulo Gebang', 'Terminal Mangkang', 'bus', 410, 455, true),
  ('SMG-SBY', 'Semarang', 'Surabaya', 'Terminal Mangkang', 'Terminal Purabaya', 'bus', 340, 350, true),
  ('BDG-JKT', 'Bandung', 'Jakarta', 'Terminal Leuwipanjang', 'Terminal Kampung Rambutan', 'bus', 190, 150, true),
  ('YGY-MLG', 'Yogyakarta', 'Malang', 'Terminal Giwangan', 'Terminal Arjosari', 'travel', 390, 365, true),
  ('JKT-BDG', 'Jakarta', 'Bandung', 'Terminal Kampung Rambutan', 'Terminal Leuwipanjang', 'travel', 210, 155, true)
on conflict (route_code) do update set
  origin_city = excluded.origin_city,
  destination_city = excluded.destination_city,
  origin_point = excluded.origin_point,
  destination_point = excluded.destination_point,
  service_type = excluded.service_type,
  duration_minutes = excluded.duration_minutes,
  distance_km = excluded.distance_km,
  is_active = excluded.is_active;

-- 2) Master armada
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
  ('MJ-31', 'Maju Jaya 31', 'B 3181 MJ', 'bus', 'Eksekutif', '2 - 2', '32 - 45 Seat', 'Belakang', 40, '2-2 eksekutif 40 seats', '["AC", "Reclining seat", "USB charger", "Audio video"]'::jsonb, true),
  ('MJ-33', 'Maju Jaya 33', 'B 3319 MJ', 'bus', 'Super Eksekutif', '2 - 1', '21 - 24 Seat', 'Belakang', 24, '2-1 super eksekutif', '["AC", "Leg rest", "USB charger", "Snack", "WiFi"]'::jsonb, true),
  ('TRV-01', 'Maju Jaya Travel 01', 'B 7101 MJ', 'travel', 'HiAce Executive', '1 - 1', '8 - 12 Seat', '-', 10, 'travel 1-1', '["AC", "Captain seat", "USB charger"]'::jsonb, true),
  ('TRV-02', 'Maju Jaya Travel 02', 'B 7102 MJ', 'travel', 'HiAce Executive', '1 - 1', '8 - 12 Seat', '-', 10, 'travel 1-1', '["AC", "Captain seat", "USB charger", "Bantal"]'::jsonb, true)
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

-- 3) Sinkron template seat untuk armada yang dipakai
delete from public.armada_seat_templates ast
using public.armadas a
where ast.armada_id = a.id
  and a.armada_code in ('MJ-09', 'MJ-12', 'MJ-21', 'MJ-27', 'MJ-31', 'MJ-33', 'TRV-01', 'TRV-02');

-- Eksekutif 2-2: 39 seat
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
where a.armada_code in ('MJ-09', 'MJ-31');

-- Super Eksekutif 2-1: 24 seat
insert into public.armada_seat_templates (armada_id, seat_number, seat_row, seat_col, seat_type)
select
  a.id,
  seat_no::text,
  ((seat_no - 1) / 3) + 1,
  (array[1, 2, 4])[(seat_no - 1) % 3 + 1],
  'regular'
from public.armadas a
cross join generate_series(1, 24) seat_no
where a.armada_code in ('MJ-12', 'MJ-33');

-- Sleeper 1-1: 20 seat
insert into public.armada_seat_templates (armada_id, seat_number, seat_row, seat_col, seat_type)
select
  a.id,
  seat_no::text,
  ((seat_no - 1) / 2) + 1,
  (array[1, 3])[(seat_no - 1) % 2 + 1],
  'regular'
from public.armadas a
cross join generate_series(1, 20) seat_no
where a.armada_code = 'MJ-21';

-- Double decker MJ-27: dek 1 (1-1) seat 1..12
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
where a.armada_code = 'MJ-27';

-- Double decker MJ-27: dek 2 (2-2) seat 13..60
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
where a.armada_code = 'MJ-27';

-- Travel 1-1: 10 seat
insert into public.armada_seat_templates (armada_id, seat_number, seat_row, seat_col, seat_type)
select
  a.id,
  concat('T', row_no),
  row_no,
  (array[1, 3])[(row_no - 1) % 2 + 1],
  'regular'
from public.armadas a
cross join generate_series(1, 10) row_no
where a.armada_code in ('TRV-01', 'TRV-02');

-- 4) Schedule template (opsional untuk admin generate)
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
select r.id, 'TPL-JKT-YGY-0730', 'Jakarta Yogyakarta 07:30', 'daily', '07:30', '16:00', 260000, current_date, current_date + interval '30 days', true
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
select r.id, 'TPL-YGY-MLG-0900', 'Yogyakarta Malang 09:00', 'daily', '09:00', '15:30', 190000, current_date, current_date + interval '30 days', true
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

-- 5) Bersihkan trip 5 hari ke depan (hanya yang belum ada booking)
with target_plans as (
  select *
  from (
    values
      ('JKT-YGY', 'MJ-09', 1, '07:30'::time, '16:00'::time, 260000::numeric),
      ('JKT-YGY', 'MJ-12', 2, '07:30'::time, '16:00'::time, 260000::numeric),
      ('JKT-YGY', 'MJ-31', 3, '07:30'::time, '16:00'::time, 255000::numeric),
      ('JKT-YGY', 'MJ-33', 4, '07:30'::time, '16:00'::time, 265000::numeric),
      ('JKT-YGY', 'MJ-21', 5, '07:30'::time, '16:00'::time, 285000::numeric),

      ('JKT-SMG', 'MJ-31', 1, '08:00'::time, '14:45'::time, 230000::numeric),
      ('JKT-SMG', 'MJ-09', 2, '08:00'::time, '14:45'::time, 225000::numeric),
      ('JKT-SMG', 'MJ-12', 3, '08:00'::time, '14:45'::time, 235000::numeric),
      ('JKT-SMG', 'MJ-33', 4, '08:00'::time, '14:45'::time, 240000::numeric),
      ('JKT-SMG', 'MJ-27', 5, '08:00'::time, '14:45'::time, 250000::numeric),

      ('SMG-SBY', 'MJ-21', 1, '19:00'::time, '00:40'::time, 320000::numeric),
      ('SMG-SBY', 'MJ-27', 2, '19:00'::time, '00:40'::time, 330000::numeric),
      ('SMG-SBY', 'MJ-33', 3, '19:00'::time, '00:40'::time, 325000::numeric),
      ('SMG-SBY', 'MJ-12', 4, '19:00'::time, '00:40'::time, 315000::numeric),
      ('SMG-SBY', 'MJ-09', 5, '19:00'::time, '00:40'::time, 305000::numeric),

      ('BDG-JKT', 'MJ-12', 1, '10:15'::time, '13:25'::time, 125000::numeric),
      ('BDG-JKT', 'MJ-33', 2, '10:15'::time, '13:25'::time, 130000::numeric),
      ('BDG-JKT', 'MJ-09', 3, '10:15'::time, '13:25'::time, 120000::numeric),
      ('BDG-JKT', 'MJ-31', 4, '10:15'::time, '13:25'::time, 122000::numeric),
      ('BDG-JKT', 'MJ-12', 5, '10:15'::time, '13:25'::time, 125000::numeric),

      ('YGY-MLG', 'TRV-01', 1, '09:00'::time, '15:30'::time, 190000::numeric),
      ('YGY-MLG', 'TRV-02', 2, '09:00'::time, '15:30'::time, 192000::numeric),
      ('YGY-MLG', 'TRV-01', 3, '09:00'::time, '15:30'::time, 190000::numeric),
      ('YGY-MLG', 'TRV-02', 4, '09:00'::time, '15:30'::time, 192000::numeric),
      ('YGY-MLG', 'TRV-01', 5, '09:00'::time, '15:30'::time, 190000::numeric),

      ('JKT-BDG', 'TRV-02', 1, '06:30'::time, '10:00'::time, 165000::numeric),
      ('JKT-BDG', 'TRV-01', 2, '06:30'::time, '10:00'::time, 160000::numeric),
      ('JKT-BDG', 'TRV-02', 3, '06:30'::time, '10:00'::time, 165000::numeric),
      ('JKT-BDG', 'TRV-01', 4, '06:30'::time, '10:00'::time, 160000::numeric),
      ('JKT-BDG', 'TRV-02', 5, '06:30'::time, '10:00'::time, 165000::numeric)
  ) as t(route_code, armada_code, day_offset, departure_time, arrival_time, price)
),
resolved as (
  select
    p.route_code,
    p.armada_code,
    p.day_offset,
    p.departure_time,
    p.arrival_time,
    p.price,
    r.id as route_id,
    a.id as armada_id
  from target_plans p
  join public.routes r on r.route_code = p.route_code
  join public.armadas a on a.armada_code = p.armada_code
),
target_departure as (
  select
    route_id,
    armada_id,
    (current_date + day_offset + departure_time)::timestamptz as departure_datetime
  from resolved
)
delete from public.trips t
using target_departure td
where t.route_id = td.route_id
  and t.armada_id = td.armada_id
  and t.departure_datetime = td.departure_datetime
  and not exists (
    select 1
    from public.bookings b
    where b.trip_id = t.id
  );

-- 6) Generate trip 5 hari ke depan
with target_plans as (
  select *
  from (
    values
      ('JKT-YGY', 'MJ-09', 1, '07:30'::time, '16:00'::time, 260000::numeric),
      ('JKT-YGY', 'MJ-12', 2, '07:30'::time, '16:00'::time, 260000::numeric),
      ('JKT-YGY', 'MJ-31', 3, '07:30'::time, '16:00'::time, 255000::numeric),
      ('JKT-YGY', 'MJ-33', 4, '07:30'::time, '16:00'::time, 265000::numeric),
      ('JKT-YGY', 'MJ-21', 5, '07:30'::time, '16:00'::time, 285000::numeric),

      ('JKT-SMG', 'MJ-31', 1, '08:00'::time, '14:45'::time, 230000::numeric),
      ('JKT-SMG', 'MJ-09', 2, '08:00'::time, '14:45'::time, 225000::numeric),
      ('JKT-SMG', 'MJ-12', 3, '08:00'::time, '14:45'::time, 235000::numeric),
      ('JKT-SMG', 'MJ-33', 4, '08:00'::time, '14:45'::time, 240000::numeric),
      ('JKT-SMG', 'MJ-27', 5, '08:00'::time, '14:45'::time, 250000::numeric),

      ('SMG-SBY', 'MJ-21', 1, '19:00'::time, '00:40'::time, 320000::numeric),
      ('SMG-SBY', 'MJ-27', 2, '19:00'::time, '00:40'::time, 330000::numeric),
      ('SMG-SBY', 'MJ-33', 3, '19:00'::time, '00:40'::time, 325000::numeric),
      ('SMG-SBY', 'MJ-12', 4, '19:00'::time, '00:40'::time, 315000::numeric),
      ('SMG-SBY', 'MJ-09', 5, '19:00'::time, '00:40'::time, 305000::numeric),

      ('BDG-JKT', 'MJ-12', 1, '10:15'::time, '13:25'::time, 125000::numeric),
      ('BDG-JKT', 'MJ-33', 2, '10:15'::time, '13:25'::time, 130000::numeric),
      ('BDG-JKT', 'MJ-09', 3, '10:15'::time, '13:25'::time, 120000::numeric),
      ('BDG-JKT', 'MJ-31', 4, '10:15'::time, '13:25'::time, 122000::numeric),
      ('BDG-JKT', 'MJ-12', 5, '10:15'::time, '13:25'::time, 125000::numeric),

      ('YGY-MLG', 'TRV-01', 1, '09:00'::time, '15:30'::time, 190000::numeric),
      ('YGY-MLG', 'TRV-02', 2, '09:00'::time, '15:30'::time, 192000::numeric),
      ('YGY-MLG', 'TRV-01', 3, '09:00'::time, '15:30'::time, 190000::numeric),
      ('YGY-MLG', 'TRV-02', 4, '09:00'::time, '15:30'::time, 192000::numeric),
      ('YGY-MLG', 'TRV-01', 5, '09:00'::time, '15:30'::time, 190000::numeric),

      ('JKT-BDG', 'TRV-02', 1, '06:30'::time, '10:00'::time, 165000::numeric),
      ('JKT-BDG', 'TRV-01', 2, '06:30'::time, '10:00'::time, 160000::numeric),
      ('JKT-BDG', 'TRV-02', 3, '06:30'::time, '10:00'::time, 165000::numeric),
      ('JKT-BDG', 'TRV-01', 4, '06:30'::time, '10:00'::time, 160000::numeric),
      ('JKT-BDG', 'TRV-02', 5, '06:30'::time, '10:00'::time, 165000::numeric)
  ) as t(route_code, armada_code, day_offset, departure_time, arrival_time, price)
),
resolved as (
  select
    r.id as route_id,
    a.id as armada_id,
    p.day_offset,
    p.departure_time,
    p.arrival_time,
    p.price
  from target_plans p
  join public.routes r on r.route_code = p.route_code
  join public.armadas a on a.armada_code = p.armada_code
)
insert into public.trips (
  route_id,
  armada_id,
  departure_datetime,
  arrival_datetime,
  price,
  status
)
select
  route_id,
  armada_id,
  (current_date + day_offset + departure_time)::timestamptz as departure_datetime,
  case
    when arrival_time <= departure_time
      then (current_date + day_offset + arrival_time + interval '1 day')::timestamptz
    else (current_date + day_offset + arrival_time)::timestamptz
  end as arrival_datetime,
  price,
  'scheduled'::public.trip_status
from resolved
on conflict (route_id, armada_id, departure_datetime) do update set
  arrival_datetime = excluded.arrival_datetime,
  price = excluded.price,
  status = excluded.status;

commit;
