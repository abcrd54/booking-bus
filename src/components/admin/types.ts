import type { ApiBooking } from "../../lib/api";

export type Summary = {
  total_users: number;
  bookings_today: number;
  paid_today: number;
  active_trips: number;
  pending_payments: ApiBooking[];
};
