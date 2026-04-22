import type { ApiTrip } from "../../lib/api";

export function currency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function tripRouteLabel(trip: ApiTrip) {
  return `${trip.route.origin_city} - ${trip.route.destination_city}`;
}

export function occupancy(trip: ApiTrip) {
  const summary = trip.seat_summary;
  if (!summary) return 0;
  const total = summary.available + summary.locked + summary.booked;
  if (total === 0) return 0;
  return Math.round(((summary.locked + summary.booked) / total) * 100);
}
