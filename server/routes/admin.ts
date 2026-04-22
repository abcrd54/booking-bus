import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { supabaseAdmin } from "../supabase";
import { sendSupabaseError } from "../utils";

const router = Router();

router.use(requireAdmin);

const routeSchema = z.object({
  route_code: z.string().min(2),
  origin_city: z.string().min(2),
  destination_city: z.string().min(2),
  origin_point: z.string().min(2),
  destination_point: z.string().min(2),
  service_type: z.enum(["bus", "travel"]).default("bus"),
  duration_minutes: z.number().int().positive(),
  distance_km: z.number().positive().optional(),
  is_active: z.boolean().default(true),
});

const armadaSchema = z.object({
  armada_code: z.string().min(2),
  name: z.string().min(2),
  plate_number: z.string().min(3),
  service_type: z.enum(["bus", "travel"]).default("bus"),
  class_type: z.string().min(2),
  seat_configuration: z.string().optional(),
  estimated_seat_range: z.string().optional(),
  toilet_location: z.string().optional(),
  seat_capacity: z.number().int().positive(),
  seat_layout_template: z.string().min(2),
  facilities: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});

const tripSchema = z.object({
  schedule_template_id: z.string().uuid().optional(),
  route_id: z.string().uuid(),
  armada_id: z.string().uuid(),
  departure_datetime: z.string().datetime(),
  arrival_datetime: z.string().datetime(),
  price: z.number().positive(),
  status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
});

const scheduleTemplateSchema = z.object({
  route_id: z.string().uuid(),
  template_code: z.string().min(2),
  name: z.string().min(2),
  schedule_type: z.enum(["daily", "custom"]).default("daily"),
  departure_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  arrival_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  default_price: z.number().positive(),
  valid_from: z.string().date().optional(),
  valid_until: z.string().date().optional(),
  is_active: z.boolean().default(true),
});

const generateTripsSchema = z.object({
  schedule_template_id: z.string().uuid(),
  service_date: z.string().date(),
  armada_ids: z.array(z.string().uuid()).min(1),
  price_override: z.number().positive().optional(),
  departure_time_override: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  arrival_time_override: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
});

const voucherSchema = z.object({
  code: z.string().min(2).transform((value) => value.trim().toUpperCase()),
  name: z.string().min(2),
  description: z.string().optional(),
  discount_type: z.enum(["fixed", "percent"]),
  discount_value: z.number().positive(),
  max_discount: z.number().positive().nullable().optional(),
  min_order_amount: z.number().min(0).default(0),
  quota: z.number().int().positive().nullable().optional(),
  valid_from: z.string().datetime().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  service_type: z.enum(["bus", "travel"]).nullable().optional(),
  terms: z.string().optional(),
  is_active: z.boolean().default(true),
});

router.get("/dashboard-summary", async (_request, response) => {
  const today = new Date().toISOString().slice(0, 10);
  const [users, bookingsToday, paidToday, activeTrips, pendingPayments] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00`),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booking_status", "paid")
      .gte("created_at", `${today}T00:00:00`),
    supabaseAdmin.from("trips").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    supabaseAdmin
      .from("bookings")
      .select("id,booking_code,total_amount,payment_status,created_at")
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return response.json({
    total_users: users.count ?? 0,
    bookings_today: bookingsToday.count ?? 0,
    paid_today: paidToday.count ?? 0,
    active_trips: activeTrips.count ?? 0,
    pending_payments: pendingPayments.data ?? [],
  });
});

router.get("/routes", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("routes")
    .select("id,route_code,origin_city,destination_city,origin_point,destination_point,service_type,duration_minutes,distance_km,is_active,created_at")
    .order("origin_city");

  if (error) {
    return sendSupabaseError(response, error, "Admin routes lookup failed");
  }

  return response.json({ routes: data });
});

router.post("/routes", async (request, response) => {
  const payload = routeSchema.safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid route payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin.from("routes").insert(payload.data).select().single();

  if (error) {
    return sendSupabaseError(response, error, "Route creation failed");
  }

  return response.status(201).json({ route: data });
});

router.put("/routes/:id", async (request, response) => {
  const payload = routeSchema.partial().safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid route payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin
    .from("routes")
    .update(payload.data)
    .eq("id", request.params.id)
    .select()
    .single();

  if (error) {
    return sendSupabaseError(response, error, "Route update failed");
  }

  return response.json({ route: data });
});

router.delete("/routes/:id", async (request, response) => {
  const { error } = await supabaseAdmin.from("routes").delete().eq("id", request.params.id);

  if (error) {
    return sendSupabaseError(response, error, "Route deletion failed");
  }

  return response.status(204).send();
});

router.get("/armadas", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("armadas")
    .select("id,armada_code,name,plate_number,service_type,class_type,seat_configuration,estimated_seat_range,toilet_location,seat_capacity,seat_layout_template,facilities,is_active,created_at")
    .order("name");

  if (error) {
    return sendSupabaseError(response, error, "Admin armadas lookup failed");
  }

  return response.json({ armadas: data });
});

router.post("/armadas", async (request, response) => {
  const payload = armadaSchema.safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid armada payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin.from("armadas").insert(payload.data).select().single();

  if (error) {
    return sendSupabaseError(response, error, "Armada creation failed");
  }

  return response.status(201).json({ armada: data });
});

router.put("/armadas/:id", async (request, response) => {
  const payload = armadaSchema.partial().safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid armada payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin
    .from("armadas")
    .update(payload.data)
    .eq("id", request.params.id)
    .select()
    .single();

  if (error) {
    return sendSupabaseError(response, error, "Armada update failed");
  }

  return response.json({ armada: data });
});

router.delete("/armadas/:id", async (request, response) => {
  const { error } = await supabaseAdmin.from("armadas").delete().eq("id", request.params.id);

  if (error) {
    return sendSupabaseError(response, error, "Armada deletion failed");
  }

  return response.status(204).send();
});

router.get("/trips", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("trips")
    .select(
      `
        id,
        schedule_template_id,
        departure_datetime,
        arrival_datetime,
        price,
        status,
        created_at,
        routes(id,route_code,origin_city,destination_city,origin_point,destination_point,service_type,duration_minutes),
        armadas(id,armada_code,name,service_type,class_type,seat_configuration,estimated_seat_range,toilet_location,seat_capacity,facilities),
        trip_seats(id,status)
      `,
    )
    .order("departure_datetime", { ascending: false });

  if (error) {
    return sendSupabaseError(response, error, "Admin trips lookup failed");
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

router.get("/schedule-templates", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("schedule_templates")
    .select(
      `
        id,
        route_id,
        template_code,
        name,
        schedule_type,
        departure_time,
        arrival_time,
        default_price,
        valid_from,
        valid_until,
        is_active,
        routes(id,route_code,origin_city,destination_city,service_type)
      `,
    )
    .order("name");

  if (error) {
    return sendSupabaseError(response, error, "Schedule templates lookup failed");
  }

  return response.json({ schedule_templates: data });
});

router.get("/vouchers", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("vouchers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return sendSupabaseError(response, error, "Admin vouchers lookup failed");
  }

  return response.json({ vouchers: data });
});

router.post("/vouchers", async (request, response) => {
  const payload = voucherSchema.safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid voucher payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin
    .from("vouchers")
    .insert(payload.data)
    .select()
    .single();

  if (error) {
    return sendSupabaseError(response, error, "Voucher creation failed");
  }

  return response.status(201).json({ voucher: data });
});

router.put("/vouchers/:id", async (request, response) => {
  const payload = voucherSchema.partial().safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid voucher payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin
    .from("vouchers")
    .update(payload.data)
    .eq("id", request.params.id)
    .select()
    .single();

  if (error) {
    return sendSupabaseError(response, error, "Voucher update failed");
  }

  return response.json({ voucher: data });
});

router.post("/schedule-templates", async (request, response) => {
  const payload = scheduleTemplateSchema.safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid schedule template payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin.from("schedule_templates").insert(payload.data).select().single();

  if (error) {
    return sendSupabaseError(response, error, "Schedule template creation failed");
  }

  return response.status(201).json({ schedule_template: data });
});

router.post("/trips/generate", async (request, response) => {
  const payload = generateTripsSchema.safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid generate trips payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin.rpc("generate_trips_manual", {
    p_schedule_template_id: payload.data.schedule_template_id,
    p_service_date: payload.data.service_date,
    p_armada_ids: payload.data.armada_ids,
    p_price_override: payload.data.price_override ?? null,
    p_departure_time_override: payload.data.departure_time_override ?? null,
    p_arrival_time_override: payload.data.arrival_time_override ?? null,
  });

  if (error) {
    return sendSupabaseError(response, error, "Trip generation failed");
  }

  return response.status(201).json({ result: data });
});

router.post("/trips", async (request, response) => {
  const payload = tripSchema.safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid trip payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin.from("trips").insert(payload.data).select().single();

  if (error) {
    return sendSupabaseError(response, error, "Trip creation failed");
  }

  return response.status(201).json({ trip: data });
});

router.put("/trips/:id", async (request, response) => {
  const payload = tripSchema.partial().safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid trip payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin
    .from("trips")
    .update(payload.data)
    .eq("id", request.params.id)
    .select()
    .single();

  if (error) {
    return sendSupabaseError(response, error, "Trip update failed");
  }

  return response.json({ trip: data });
});

router.delete("/trips/:id", async (request, response) => {
  const { error } = await supabaseAdmin.from("trips").delete().eq("id", request.params.id);

  if (error) {
    return sendSupabaseError(response, error, "Trip deletion failed");
  }

  return response.status(204).send();
});

router.get("/trips/:id/seats", async (request, response) => {
  const { data, error } = await supabaseAdmin
    .from("trip_seats")
    .select("*,bookings(booking_code,user_id,total_amount,booking_status,payment_status)")
    .eq("trip_id", request.params.id)
    .order("seat_row")
    .order("seat_col");

  if (error) {
    return sendSupabaseError(response, error, "Admin trip seats lookup failed");
  }

  return response.json({ seats: data });
});

router.get("/bookings", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("*,profiles(email,name,phone),trips(departure_datetime,routes(origin_city,destination_city))")
    .order("created_at", { ascending: false });

  if (error) {
    return sendSupabaseError(response, error, "Admin bookings lookup failed");
  }

  return response.json({ bookings: data });
});

router.get("/users", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,name,phone,address,role,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return sendSupabaseError(response, error, "Admin users lookup failed");
  }

  return response.json({ users: data });
});

export default router;
