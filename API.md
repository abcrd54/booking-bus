# MAJU JAYA API

Base URL lokal:

```txt
http://localhost:8787/api/v1
```

Website memakai API lewat origin yang terdaftar di `WEB_ORIGIN`, jadi API key tidak disimpan di bundle frontend.

Aplikasi mobile atau client eksternal wajib memakai API key:

```http
x-api-key: dev_flutter_key_change_me
```

Endpoint user yang membutuhkan login juga wajib memakai Supabase access token:

```http
Authorization: Bearer <supabase_access_token>
```

## Setup

1. Copy `.env.example` menjadi `.env`.
2. Isi `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`.
3. Isi `APP_API_KEYS` dengan key untuk aplikasi/mobile. Pisahkan beberapa key dengan koma jika perlu.
4. Jalankan SQL di `supabase/schema.sql` lewat Supabase SQL Editor.
5. Jalankan SQL dummy data di `supabase/seed.sql` jika butuh data awal untuk testing.
6. Untuk development, jalankan API dan web secara manual sesuai kebutuhan:

```bash
npm run api
npm run dev:web
```

Jangan gunakan `npm run dev` jika kamu ingin mengontrol proses web dan API secara terpisah.

## Public

```http
GET /routes
GET /armadas
GET /trips/search?origin=Jakarta&destination=Yogyakarta&date=2026-04-22
GET /trips/:id
GET /trips/:id/seats
```

## Auth

```http
POST /auth/register
POST /auth/login
GET /auth/me
POST /auth/logout
```

Register body:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Nama User",
  "phone": "08123456789",
  "address": "Jakarta"
}
```

Login body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

## User Booking

```http
POST /bookings
GET /bookings/:id
GET /my-bookings
POST /payments/create
```

Create booking body:

```json
{
  "trip_id": "uuid-trip",
  "seat_ids": ["uuid-seat-1", "uuid-seat-2"]
}
```

## Admin

Admin endpoint dari aplikasi/client eksternal membutuhkan `x-api-key` dan Bearer token dari user dengan `profiles.role = 'admin'`.
Request dari website tetap tidak memakai API key, tapi tetap wajib Bearer token admin.

```http
GET /admin/dashboard-summary
GET /admin/schedule-templates
POST /admin/schedule-templates
POST /admin/trips/generate
POST /admin/routes
PUT /admin/routes/:id
DELETE /admin/routes/:id
POST /admin/armadas
PUT /admin/armadas/:id
DELETE /admin/armadas/:id
POST /admin/trips
PUT /admin/trips/:id
DELETE /admin/trips/:id
GET /admin/trips/:id/seats
GET /admin/bookings
GET /admin/users
```

## Contoh Curl

Client eksternal:

```bash
curl "http://localhost:8787/api/v1/trips/search?origin=Jakarta&destination=Yogyakarta" \
  -H "x-api-key: dev_flutter_key_change_me"
```

```bash
curl "http://localhost:8787/api/v1/my-bookings" \
  -H "x-api-key: dev_flutter_key_change_me" \
  -H "Authorization: Bearer <supabase_access_token>"
```

## Catatan Keamanan

API key hanya dipakai untuk aplikasi/mobile atau client eksternal. Website tidak menyimpan API key agar tidak masuk bundle browser.

API key mobile tetap bisa diekstrak dari aplikasi, jadi jangan jadikan API key sebagai satu-satunya pengaman transaksi. Proteksi utama tetap Supabase user token, role admin di tabel `profiles`, RLS, dan operasi server-side/database seperti `create_booking_with_seat_lock`.
