import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { requireUser, type AuthedRequest } from "../middleware/auth.js";
import { config } from "../config.js";
import { supabaseAdmin } from "../supabase.js";
import { sendSupabaseError } from "../utils.js";

const router = Router();

const createBookingSchema = z.object({
  trip_id: z.string().uuid(),
  seat_ids: z.array(z.string().uuid()).min(1).max(8),
  voucher_code: z.string().min(2).optional(),
});

const midtransWebhookSchema = z.object({
  order_id: z.string().min(1),
  status_code: z.string().min(1),
  gross_amount: z.union([z.string(), z.number()]),
  signature_key: z.string().min(1),
  transaction_status: z.string().min(1),
  fraud_status: z.string().optional(),
  payment_type: z.string().optional(),
  transaction_id: z.string().optional(),
  merchant_id: z.string().optional(),
});

type BookingStatus = "pending_payment" | "paid" | "cancelled" | "expired";
type PaymentStatus = "pending" | "settlement" | "expire" | "cancel" | "deny";

function mapMidtransToBookingState(transactionStatus: string, fraudStatus?: string) {
  let bookingStatus: BookingStatus = "pending_payment";
  let paymentStatus: PaymentStatus = "pending";
  let shouldBookSeats = false;
  let shouldReleaseSeats = false;

  if (transactionStatus === "capture") {
    if (fraudStatus === "challenge") {
      bookingStatus = "pending_payment";
      paymentStatus = "pending";
    } else {
      bookingStatus = "paid";
      paymentStatus = "settlement";
      shouldBookSeats = true;
    }
  } else if (transactionStatus === "settlement") {
    bookingStatus = "paid";
    paymentStatus = "settlement";
    shouldBookSeats = true;
  } else if (transactionStatus === "pending") {
    bookingStatus = "pending_payment";
    paymentStatus = "pending";
  } else if (transactionStatus === "expire") {
    bookingStatus = "expired";
    paymentStatus = "expire";
    shouldReleaseSeats = true;
  } else if (transactionStatus === "cancel") {
    bookingStatus = "cancelled";
    paymentStatus = "cancel";
    shouldReleaseSeats = true;
  } else if (transactionStatus === "deny") {
    bookingStatus = "cancelled";
    paymentStatus = "deny";
    shouldReleaseSeats = true;
  }

  return { bookingStatus, paymentStatus, shouldBookSeats, shouldReleaseSeats };
}

async function applyBookingPaymentStatus(params: {
  bookingId: string;
  totalAmount: number;
  orderId: string;
  transactionStatus: string;
  fraudStatus?: string;
  paymentType?: string;
  transactionId?: string;
  rawResponse: unknown;
}) {
  const state = mapMidtransToBookingState(params.transactionStatus, params.fraudStatus);

  const { data: updatedBooking, error: updateBookingError } = await supabaseAdmin
    .from("bookings")
    .update({
      booking_status: state.bookingStatus,
      payment_status: state.paymentStatus,
    })
    .eq("id", params.bookingId)
    .select("id,booking_code,booking_status,payment_status,total_amount,midtrans_order_id")
    .single();

  if (updateBookingError || !updatedBooking) {
    throw updateBookingError ?? new Error("Booking payment update failed");
  }

  if (state.shouldBookSeats) {
    await supabaseAdmin
      .from("trip_seats")
      .update({
        status: "booked",
        locked_until: null,
      })
      .eq("booking_id", params.bookingId);
  } else if (state.shouldReleaseSeats) {
    await supabaseAdmin
      .from("trip_seats")
      .update({
        status: "available",
        locked_until: null,
        booking_id: null,
      })
      .eq("booking_id", params.bookingId);
  }

  const paymentUpdate = {
    transaction_id: params.transactionId ?? null,
    transaction_status: params.transactionStatus,
    fraud_status: params.fraudStatus ?? null,
    payment_type: params.paymentType ?? null,
    raw_response: params.rawResponse,
    updated_at: new Date().toISOString(),
  };

  const { data: existingPayments, error: existingPaymentError } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("booking_id", params.bookingId)
    .eq("order_id", params.orderId);

  if (!existingPaymentError && existingPayments && existingPayments.length > 0) {
    await supabaseAdmin
      .from("payments")
      .update(paymentUpdate)
      .eq("booking_id", params.bookingId)
      .eq("order_id", params.orderId);
  } else {
    await supabaseAdmin.from("payments").insert({
      booking_id: params.bookingId,
      provider: "midtrans",
      order_id: params.orderId,
      gross_amount: Number(params.totalAmount),
      ...paymentUpdate,
    });
  }

  return updatedBooking;
}

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
        midtrans_order_id,
        created_at,
        trips(id,departure_datetime,routes(origin_city,destination_city),armadas(name,class_type)),
        booking_seats(id,price,trip_seats(seat_number,status))
      `,
    )
    .eq("user_id", request.user!.id)
    .order("created_at", { ascending: false });

  if (error) {
    return sendSupabaseError(response, error, "My bookings lookup failed");
  }

  return response.json({ bookings: data });
});

router.post("/payments/sync", requireUser, async (request: AuthedRequest, response) => {
  if (!config.midtrans.serverKey) {
    return response.status(503).json({
      error: "Midtrans not configured",
      message: "MIDTRANS_SERVER_KEY belum terpasang di environment API.",
    });
  }

  const { data: pendingBookings, error: pendingError } = await supabaseAdmin
    .from("bookings")
    .select("id,total_amount,midtrans_order_id,payment_status")
    .eq("user_id", request.user!.id)
    .eq("payment_status", "pending")
    .not("midtrans_order_id", "is", null);

  if (pendingError) {
    return sendSupabaseError(response, pendingError, "Pending booking lookup failed");
  }

  if (!pendingBookings || pendingBookings.length === 0) {
    return response.json({ ok: true, synced: 0, message: "No pending payments" });
  }

  const midtransApiBase = config.midtrans.isProduction
    ? "https://api.midtrans.com/v2"
    : "https://api.sandbox.midtrans.com/v2";
  const authHeader = `Basic ${Buffer.from(`${config.midtrans.serverKey}:`).toString("base64")}`;

  let synced = 0;
  const failures: Array<{ booking_id: string; message: string }> = [];

  for (const booking of pendingBookings) {
    const orderId = booking.midtrans_order_id?.trim();
    if (!orderId) continue;

    try {
      const statusResponse = await fetch(`${midtransApiBase}/${encodeURIComponent(orderId)}/status`, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      });
      const statusJson = (await statusResponse.json()) as {
        transaction_status?: string;
        fraud_status?: string;
        payment_type?: string;
        transaction_id?: string;
      };

      if (!statusResponse.ok || !statusJson.transaction_status) {
        failures.push({
          booking_id: booking.id,
          message: "Midtrans status request failed",
        });
        continue;
      }

      await applyBookingPaymentStatus({
        bookingId: booking.id,
        totalAmount: Number(booking.total_amount),
        orderId,
        transactionStatus: statusJson.transaction_status,
        fraudStatus: statusJson.fraud_status,
        paymentType: statusJson.payment_type,
        transactionId: statusJson.transaction_id,
        rawResponse: statusJson,
      });

      synced += 1;
    } catch (error) {
      failures.push({
        booking_id: booking.id,
        message: error instanceof Error ? error.message : "Unknown sync error",
      });
    }
  }

  return response.json({
    ok: true,
    synced,
    pending: pendingBookings.length,
    failed: failures.length,
    failures,
  });
});

router.post("/payments/create", requireUser, async (request: AuthedRequest, response) => {
  const payload = z
    .object({
      booking_id: z.string().uuid(),
      return_to_app: z.boolean().optional(),
    })
    .safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid payment payload", details: payload.error.flatten() });
  }

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id,booking_code,total_amount,user_id,booking_status,payment_status,midtrans_order_id")
    .eq("id", payload.data.booking_id)
    .eq("user_id", request.user!.id)
    .single();

  if (error) {
    return sendSupabaseError(response, error, "Booking payment lookup failed");
  }

  if (!config.midtrans.serverKey) {
    return response.status(503).json({
      error: "Midtrans not configured",
      message: "MIDTRANS_SERVER_KEY belum terpasang di environment API.",
    });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name,email,phone")
    .eq("id", request.user!.id)
    .maybeSingle();

  const orderId =
    booking.midtrans_order_id && booking.midtrans_order_id.trim() !== ""
      ? booking.midtrans_order_id
      : `MJ-${booking.booking_code}-${Date.now()}`;

  const midtransApiBase = config.midtrans.isProduction
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";
  const authHeader = `Basic ${Buffer.from(`${config.midtrans.serverKey}:`).toString("base64")}`;

  const snapPayload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Number(booking.total_amount),
    },
    customer_details: {
      first_name: profile?.name || "Maju Jaya User",
      email: profile?.email || request.user?.email || undefined,
      phone: profile?.phone || undefined,
    },
    callbacks: {
      finish: payload.data.return_to_app
        ? config.midtrans.finishRedirectUrlApp
        : config.midtrans.finishRedirectUrl,
    },
  };

  let snapResponse: unknown;
  try {
    const snapRequest = await fetch(`${midtransApiBase}/transactions`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(snapPayload),
    });

    const parsed = (await snapRequest.json()) as {
      token?: string;
      redirect_url?: string;
      status_message?: string;
      error_messages?: string[];
    };

    if (!snapRequest.ok || !parsed.redirect_url) {
      return response.status(400).json({
        error: "Midtrans transaction failed",
        message:
          parsed.status_message ||
          parsed.error_messages?.join(", ") ||
          "Gagal membuat transaksi Snap Midtrans.",
      });
    }

    snapResponse = parsed;
  } catch (midtransError) {
    return response.status(502).json({
      error: "Midtrans request failed",
      message: midtransError instanceof Error ? midtransError.message : "Tidak bisa terhubung ke Midtrans.",
    });
  }

  const snap = snapResponse as { token?: string; redirect_url: string };

  await supabaseAdmin
    .from("bookings")
    .update({
      midtrans_order_id: orderId,
      booking_status: "pending_payment",
      payment_status: "pending",
    })
    .eq("id", booking.id);

  await supabaseAdmin.from("payments").insert({
    booking_id: booking.id,
    provider: "midtrans",
    order_id: orderId,
    gross_amount: Number(booking.total_amount),
    transaction_status: "pending",
    raw_response: snapResponse,
  });

  return response.json({
    booking: {
      ...booking,
      midtrans_order_id: orderId,
    },
    payment: {
      provider: "midtrans",
      status: "pending",
      snap_token: snap.token ?? null,
      redirect_url: snap.redirect_url,
      order_id: orderId,
    },
  });
});

router.post("/payments/midtrans/webhook", async (request, response) => {
  const payload = midtransWebhookSchema.safeParse(request.body);
  if (!payload.success) {
    return response.status(422).json({ error: "Invalid webhook payload", details: payload.error.flatten() });
  }

  if (!config.midtrans.serverKey) {
    return response.status(503).json({ error: "Midtrans not configured" });
  }

  const data = payload.data;
  const grossAmount = String(data.gross_amount);
  const signatureBase = `${data.order_id}${data.status_code}${grossAmount}${config.midtrans.serverKey}`;
  const expectedSignature = crypto
    .createHash("sha512")
    .update(signatureBase)
    .digest("hex");

  if (expectedSignature !== data.signature_key) {
    return response.status(403).json({ error: "Invalid Midtrans signature" });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id,booking_code,total_amount,booking_status,payment_status,midtrans_order_id")
    .eq("midtrans_order_id", data.order_id)
    .maybeSingle();

  if (bookingError) {
    return sendSupabaseError(response, bookingError, "Webhook booking lookup failed");
  }

  if (!booking) {
    return response.status(404).json({ error: "Booking not found for this order_id" });
  }

  let updatedBooking;
  try {
    updatedBooking = await applyBookingPaymentStatus({
      bookingId: booking.id,
      totalAmount: Number(booking.total_amount),
      orderId: data.order_id,
      transactionStatus: data.transaction_status,
      fraudStatus: data.fraud_status,
      paymentType: data.payment_type,
      transactionId: data.transaction_id,
      rawResponse: request.body,
    });
  } catch (error) {
    return response.status(500).json({
      error: "Webhook booking update failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return response.json({
    ok: true,
    booking: updatedBooking,
    webhook: {
      order_id: data.order_id,
      transaction_status: data.transaction_status,
      fraud_status: data.fraud_status ?? null,
    },
  });
});

export default router;
