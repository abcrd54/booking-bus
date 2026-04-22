import { Router } from "express";
import { z } from "zod";
import { requireUser, type AuthedRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";
import { sendSupabaseError } from "../utils.js";

const router = Router();

const createBookingSchema = z.object({
  trip_id: z.string().uuid(),
  seat_ids: z.array(z.string().uuid()).min(1).max(8),
  voucher_code: z.string().min(2).optional(),
});

function calculateDiscount(voucher: { discount_type: string; discount_value: number; max_discount: number | null }, subtotal: number) {
  const rawDiscount = voucher.discount_type === "percent"
    ? Math.floor((subtotal * Number(voucher.discount_value)) / 100)
    : Number(voucher.discount_value);

  return Math.max(0, Math.min(rawDiscount, Number(voucher.max_discount ?? rawDiscount), subtotal));
}

async function applyVoucherToBooking(booking: { id: string; total_amount: number }, voucherCode: string) {
  const code = voucherCode.trim().toUpperCase();
  const { data: bookingDetail, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id,total_amount,trips(routes(service_type))")
    .eq("id", booking.id)
    .single();

  if (bookingError || !bookingDetail) {
    return { error: bookingError ?? new Error("Booking not found") };
  }

  const trip = bookingDetail.trips as unknown as { routes?: { service_type?: "bus" | "travel" } };
  const serviceType = trip.routes?.service_type;

  const { data: voucher, error: voucherError } = await supabaseAdmin
    .from("vouchers")
    .select("id,code,discount_type,discount_value,max_discount,min_order_amount,quota,used_count,valid_from,valid_until,service_type,is_active")
    .eq("code", code)
    .maybeSingle();

  if (voucherError) return { error: voucherError };
  if (!voucher || !voucher.is_active) return { responseError: "Voucher tidak ditemukan atau tidak aktif." };

  const now = new Date();
  if (voucher.valid_from && new Date(voucher.valid_from) > now) return { responseError: "Voucher belum berlaku." };
  if (voucher.valid_until && new Date(voucher.valid_until) < now) return { responseError: "Voucher sudah berakhir." };
  if (voucher.quota !== null && voucher.used_count >= voucher.quota) return { responseError: "Kuota voucher sudah habis." };
  if (Number(bookingDetail.total_amount) < Number(voucher.min_order_amount)) return { responseError: `Minimal transaksi ${Number(voucher.min_order_amount).toLocaleString("id-ID")}.` };
  if (voucher.service_type && serviceType && voucher.service_type !== serviceType) return { responseError: `Voucher hanya berlaku untuk layanan ${voucher.service_type}.` };

  const discount = calculateDiscount(voucher, Number(bookingDetail.total_amount));
  const nextTotal = Math.max(0, Number(bookingDetail.total_amount) - discount);

  const { data: updatedBooking, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ total_amount: nextTotal })
    .eq("id", booking.id)
    .select("id,booking_code,user_id,trip_id,total_amount,booking_status,payment_status,created_at")
    .single();

  if (updateError) return { error: updateError };

  await supabaseAdmin
    .from("vouchers")
    .update({ used_count: Number(voucher.used_count) + 1 })
    .eq("id", voucher.id);

  return {
    booking: updatedBooking,
    voucher: {
      code,
      discount,
      subtotal: Number(bookingDetail.total_amount),
      total: nextTotal,
    },
  };
}

router.post("/bookings", requireUser, async (request: AuthedRequest, response) => {
  const payload = createBookingSchema.safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid booking payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAdmin.rpc("create_booking_with_seat_lock", {
    p_user_id: request.user!.id,
    p_trip_id: payload.data.trip_id,
    p_seat_ids: payload.data.seat_ids,
  });

  if (error) {
    return sendSupabaseError(response, error, "Booking creation failed");
  }

  if (payload.data.voucher_code) {
    const voucherResult = await applyVoucherToBooking(data as { id: string; total_amount: number }, payload.data.voucher_code);

    if (voucherResult.error) {
      return sendSupabaseError(response, voucherResult.error, "Voucher application failed");
    }

    if (voucherResult.responseError) {
      return response.status(400).json({ error: voucherResult.responseError, booking: data });
    }

    return response.status(201).json({ booking: voucherResult.booking, voucher: voucherResult.voucher });
  }

  return response.status(201).json({ booking: data });
});

router.get("/bookings/:id", requireUser, async (request: AuthedRequest, response) => {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      `
        id,
        booking_code,
        user_id,
        total_amount,
        booking_status,
        payment_status,
        midtrans_order_id,
        created_at,
        trips(id,departure_datetime,arrival_datetime,price,routes(origin_city,destination_city),armadas(name,class_type)),
        booking_seats(id,price,trip_seats(seat_number,status))
      `,
    )
    .eq("id", request.params.id)
    .eq("user_id", request.user!.id)
    .single();

  if (error) {
    return sendSupabaseError(response, error, "Booking lookup failed");
  }

  return response.json({ booking: data });
});

router.get("/my-bookings", requireUser, async (request: AuthedRequest, response) => {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      `
        id,
        booking_code,
        total_amount,
        booking_status,
        payment_status,
        created_at,
        trips(id,departure_datetime,routes(origin_city,destination_city),armadas(name,class_type))
      `,
    )
    .eq("user_id", request.user!.id)
    .order("created_at", { ascending: false });

  if (error) {
    return sendSupabaseError(response, error, "My bookings lookup failed");
  }

  return response.json({ bookings: data });
});

router.post("/payments/create", requireUser, async (request: AuthedRequest, response) => {
  const payload = z.object({ booking_id: z.string().uuid() }).safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid payment payload", details: payload.error.flatten() });
  }

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id,booking_code,total_amount,user_id,booking_status,payment_status")
    .eq("id", payload.data.booking_id)
    .eq("user_id", request.user!.id)
    .single();

  if (error) {
    return sendSupabaseError(response, error, "Booking payment lookup failed");
  }

  return response.json({
    booking,
    payment: {
      provider: "midtrans",
      status: "not_implemented",
      message: "Midtrans Snap token generation is ready to be wired with MIDTRANS_SERVER_KEY.",
    },
  });
});

export default router;
