const API_BASE_URL = "/api/v1";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export type ApiProfile = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  address?: string;
  role: "admin" | "user";
};

export type ApiSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

export type ApiRoute = {
  id: string;
  route_code: string;
  origin_city: string;
  destination_city: string;
  origin_point: string;
  destination_point: string;
  service_type: "bus" | "travel";
  duration_minutes: number;
  is_active: boolean;
};

export type ApiArmada = {
  id: string;
  armada_code: string;
  name: string;
  plate_number: string;
  service_type: "bus" | "travel";
  class_type: string;
  seat_configuration?: string | null;
  estimated_seat_range?: string | null;
  toilet_location?: string | null;
  seat_capacity: number;
  seat_layout_template: string;
  facilities: string[];
  is_active: boolean;
};

export type ApiTrip = {
  id: string;
  route: {
    route_code?: string;
    origin_city: string;
    destination_city: string;
    origin_point?: string;
    destination_point?: string;
    service_type: "bus" | "travel";
    duration_minutes: number;
  };
  armada: {
    armada_code?: string;
    name: string;
    service_type: "bus" | "travel";
    class_type: string;
    seat_configuration?: string | null;
    estimated_seat_range?: string | null;
    toilet_location?: string | null;
    seat_capacity?: number;
    facilities?: string[];
  };
  departure_datetime: string;
  arrival_datetime: string;
  price: number;
  status: "scheduled" | "completed" | "cancelled";
  seats_left: number;
  seat_summary?: {
    available: number;
    locked: number;
    booked: number;
  };
};

export type ApiScheduleTemplate = {
  id: string;
  route_id: string;
  template_code: string;
  name: string;
  schedule_type: "daily" | "custom";
  departure_time: string;
  arrival_time: string;
  default_price: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  routes?: {
    id: string;
    route_code: string;
    origin_city: string;
    destination_city: string;
    service_type: "bus" | "travel";
  };
};

export type ApiSeat = {
  id: string;
  trip_id: string;
  seat_number: string;
  seat_row: number;
  seat_col: number;
  deck: number;
  seat_type: string;
  status: "available" | "locked" | "booked";
  locked_until?: string | null;
};

export type ApiBooking = {
  id: string;
  booking_code: string;
  total_amount: number;
  booking_status: string;
  payment_status: string;
  created_at: string;
  profiles?: {
    email?: string;
    name?: string;
    phone?: string;
  };
  trips?: {
    departure_datetime?: string;
    routes?: {
      origin_city?: string;
      destination_city?: string;
    };
  };
};

export type ApiVoucher = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discount_type: "fixed" | "percent";
  discount_value: number;
  max_discount?: number | null;
  min_order_amount: number;
  quota?: number | null;
  used_count: number;
  valid_from?: string | null;
  valid_until?: string | null;
  service_type?: "bus" | "travel" | null;
  terms?: string | null;
  is_active: boolean;
  created_at?: string;
};

async function apiRequest<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const { token, ...requestInit } = init ?? {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...requestInit.headers,
    },
  });

  if (!response.ok) {
    let payload: { error?: string; message?: string; details?: unknown } | null = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const message = payload?.message || payload?.error || `API request failed: ${response.status}`;
    throw new ApiError(message, response.status, payload?.details);
  }

  return response.json() as Promise<T>;
}

export async function login(payload: { email: string; password: string }) {
  return apiRequest<{ session: ApiSession; profile: ApiProfile }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function register(payload: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  address?: string;
}) {
  return apiRequest<{ session: ApiSession | null; user: unknown }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRoutes() {
  return apiRequest<{ routes: ApiRoute[] }>("/routes");
}

export async function getArmadas() {
  return apiRequest<{ armadas: ApiArmada[] }>("/armadas");
}

export async function searchTrips(params: {
  origin?: string;
  destination?: string;
  date?: string;
  service_type?: "bus" | "travel";
}) {
  const search = new URLSearchParams();

  if (params.origin) search.set("origin", params.origin);
  if (params.destination) search.set("destination", params.destination);
  if (params.date) search.set("date", params.date);
  if (params.service_type) search.set("service_type", params.service_type);

  return apiRequest<{ trips: ApiTrip[] }>(`/trips/search?${search.toString()}`);
}

export async function getTripSeats(tripId: string) {
  return apiRequest<{ seats: ApiSeat[] }>(`/trips/${tripId}/seats`);
}

export async function validateVoucher(payload: { code: string; subtotal: number; service_type?: "bus" | "travel" }) {
  return apiRequest<{ voucher: ApiVoucher; discount: number; subtotal: number; total: number }>("/vouchers/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAdminSummary(token: string) {
  return apiRequest<{
    total_users: number;
    bookings_today: number;
    paid_today: number;
    active_trips: number;
    pending_payments: ApiBooking[];
  }>("/admin/dashboard-summary", { token });
}

export async function getAdminRoutes(token: string) {
  return apiRequest<{ routes: ApiRoute[] }>("/admin/routes", { token });
}

export async function getAdminArmadas(token: string) {
  return apiRequest<{ armadas: ApiArmada[] }>("/admin/armadas", { token });
}

export async function getAdminTrips(token: string) {
  return apiRequest<{ trips: ApiTrip[] }>("/admin/trips", { token });
}

export async function getAdminScheduleTemplates(token: string) {
  return apiRequest<{ schedule_templates: ApiScheduleTemplate[] }>("/admin/schedule-templates", { token });
}

export async function getAdminVouchers(token: string) {
  return apiRequest<{ vouchers: ApiVoucher[] }>("/admin/vouchers", { token });
}

export async function createAdminVoucher(
  token: string,
  payload: {
    code: string;
    name: string;
    description?: string;
    discount_type: "fixed" | "percent";
    discount_value: number;
    max_discount?: number | null;
    min_order_amount?: number;
    quota?: number | null;
    valid_from?: string | null;
    valid_until?: string | null;
    service_type?: "bus" | "travel" | null;
    terms?: string;
    is_active?: boolean;
  },
) {
  return apiRequest<{ voucher: ApiVoucher }>("/admin/vouchers", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function createAdminScheduleTemplate(
  token: string,
  payload: {
    route_id: string;
    template_code: string;
    name: string;
    schedule_type: "daily" | "custom";
    departure_time: string;
    arrival_time: string;
    default_price: number;
    valid_from?: string;
    valid_until?: string;
    is_active?: boolean;
  },
) {
  return apiRequest<{ schedule_template: ApiScheduleTemplate }>("/admin/schedule-templates", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function generateAdminTrips(
  token: string,
  payload: {
    schedule_template_id: string;
    service_date: string;
    armada_ids: string[];
    price_override?: number;
    departure_time_override?: string;
    arrival_time_override?: string;
  },
) {
  return apiRequest<{ result: { created: number; skipped: number; reason?: string } }>("/admin/trips/generate", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function getAdminBookings(token: string) {
  return apiRequest<{ bookings: ApiBooking[] }>("/admin/bookings", { token });
}

export async function getAdminUsers(token: string) {
  return apiRequest<{ users: ApiProfile[] }>("/admin/users", { token });
}

export async function getAdminTripSeats(token: string, tripId: string) {
  return apiRequest<{ seats: ApiSeat[] }>(`/admin/trips/${tripId}/seats`, { token });
}
