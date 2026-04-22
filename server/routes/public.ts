import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../supabase.js";
import { sendSupabaseError } from "../utils.js";

const router = Router();

const searchSchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  date: z.string().optional(),
  service_type: z.enum(["bus", "travel"]).optional(),
});

const voucherValidationSchema = z.object({
  code: z.string().min(2),
  subtotal: z.number().positive(),
  service_type: z.enum(["bus", "travel"]).optional(),
});

function calculateDiscount(voucher: { discount_type: string; discount_value: number; max_discount: number | null }, subtotal: number) {
  const rawDiscount = voucher.discount_type === "percent"
    ? Math.floor((subtotal * Number(voucher.discount_value)) / 100)
    : Number(voucher.discount_value);

  return Math.max(0, Math.min(rawDiscount, Number(voucher.max_discount ?? rawDiscount), subtotal));
}

router.get("/routes", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("routes")
    .select("id,route_code,origin_city,destination_city,origin_point,destination_point,service_type,duration_minutes,is_active")
    .eq("is_active", true)
    .order("origin_city");

  if (error) {
    return sendSupabaseError(response, error, "Routes lookup failed");
  }

  return response.json({ routes: data });
});

router.get("/armadas", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("armadas")
    .select("id,armada_code,name,plate_number,service_type,class_type,seat_configuration,estimated_seat_range,toilet_location,seat_capacity,seat_layout_template,facilities,is_active")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return sendSupabaseError(response, error, "Armadas lookup failed");
  }

  return response.json({ armadas: data });
});

router.get("/trips/search", async (request, response) => {
  const parsed = searchSchema.safeParse(request.query);

  if (!parsed.success) {
    return response.status(422).json({ error: "Invalid search params", details: parsed.error.flatten() });
  }

  const { origin, destination, date, service_type } = parsed.data;
  let query = supabaseAdmin
    .from("trips")
    .select(
      `
        id,
        departure_datetime,
        arrival_datetime,
        price,
        status,
        routes!inner(id,route_code,origin_city,destination_city,origin_point,destination_point,service_type,duration_minutes),
        armadas!inner(id,armada_code,name,service_type,class_type,seat_configuration,estimated_seat_range,toilet_location,seat_capacity,facilities),
        trip_seats(id,status)
      `,
    )
    .eq("status", "scheduled")
    .order("departure_datetime");

  if (origin) {
    query = query.ilike("routes.origin_city", `%${origin}%`);
  }

  if (destination) {
    query = query.ilike("routes.destination_city", `%${destination}%`);
  }

  if (service_type) {
    query = query.eq("routes.service_type", service_type);
  }

  if (date) {
    query = query
      .gte("departure_datetime", `${date}T00:00:00`)
      .lt("departure_datetime", `${date}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    return sendSupabaseError(response, error, "Trips lookup failed");
  }

  const trips = data.map((trip) => {
    const seats = trip.trip_seats ?? [];
    const availableSeats = seats.filter((seat) => seat.status === "available").length;

    return {
      id: trip.id,
      route: trip.routes,
      armada: trip.armadas,
      departure_datetime: trip.departure_datetime,
      arrival_datetime: trip.arrival_datetime,
      price: trip.price,
      status: trip.status,
      seats_left: availableSeats,
      seat_summary: {
        available: availableSeats,
        locked: seats.filter((seat) => seat.status === "locked").length,
        booked: seats.filter((seat) => seat.status === "booked").length,
      },
    };
  });

  return response.json({ trips });
});

router.get("/trips/:id", async (request, response) => {
  const { data, error } = await supabaseAdmin
    .from("trips")
    .select(
      `
        id,
        departure_datetime,
        arrival_datetime,
        price,
        status,
        routes(id,route_code,origin_city,destination_city,origin_point,destination_point,service_type,duration_minutes),
        armadas(id,armada_code,name,service_type,class_type,seat_configuration,estimated_seat_range,toilet_location,seat_capacity,facilities)
      `,
    )
    .eq("id", request.params.id)
    .single();

  if (error) {
    return sendSupabaseError(response, error, "Trip detail lookup failed");
  }

  return response.json({ trip: data });
});

router.get("/trips/:id/seats", async (request, response) => {
  const { data, error } = await supabaseAdmin
    .from("trip_seats")
    .select("id,trip_id,seat_number,seat_row,seat_col,deck,seat_type,status,locked_until")
    .eq("trip_id", request.params.id)
    .order("seat_row")
    .order("seat_col");

  if (error) {
    return sendSupabaseError(response, error, "Trip seats lookup failed");
  }

  return response.json({ seats: data });
});

router.post("/vouchers/validate", async (request, response) => {
  const payload = voucherValidationSchema.safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid voucher payload", details: payload.error.flatten() });
  }

  const code = payload.data.code.trim().toUpperCase();
  const { data: voucher, error } = await supabaseAdmin
    .from("vouchers")
    .select("id,code,name,description,discount_type,discount_value,max_discount,min_order_amount,quota,used_count,valid_from,valid_until,service_type,terms,is_active")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    return sendSupabaseError(response, error, "Voucher lookup failed");
  }

  if (!voucher || !voucher.is_active) {
    return response.status(404).json({ error: "Voucher tidak ditemukan atau tidak aktif." });
  }

  const now = new Date();
  if (voucher.valid_from && new Date(voucher.valid_from) > now) {
    return response.status(400).json({ error: "Voucher belum berlaku." });
  }

  if (voucher.valid_until && new Date(voucher.valid_until) < now) {
    return response.status(400).json({ error: "Voucher sudah berakhir." });
  }

  if (voucher.quota !== null && voucher.used_count >= voucher.quota) {
    return response.status(400).json({ error: "Kuota voucher sudah habis." });
  }

  if (Number(payload.data.subtotal) < Number(voucher.min_order_amount)) {
    return response.status(400).json({ error: `Minimal transaksi ${Number(voucher.min_order_amount).toLocaleString("id-ID")}.` });
  }

  if (voucher.service_type && payload.data.service_type && voucher.service_type !== payload.data.service_type) {
    return response.status(400).json({ error: `Voucher hanya berlaku untuk layanan ${voucher.service_type}.` });
  }

  const discount = calculateDiscount(voucher, payload.data.subtotal);

  return response.json({
    voucher,
    discount,
    subtotal: payload.data.subtotal,
    total: Math.max(0, payload.data.subtotal - discount),
  });
});

export default router;
