import type { ApiSeat, ApiTrip } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "./empty-state";
import { formatDateTime, tripRouteLabel } from "./utils";

type SeatsPanelProps = {
  trips: ApiTrip[];
  seats: ApiSeat[];
  selectedTripId: string;
  onSelectTrip: (tripId: string) => void;
};

export function SeatsPanel({ trips, seats, selectedTripId, onSelectTrip }: SeatsPanelProps) {
  const available = seats.filter((seat) => seat.status === "available").length;
  const locked = seats.filter((seat) => seat.status === "locked").length;
  const booked = seats.filter((seat) => seat.status === "booked").length;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Seat occupancy</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="mb-4 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold"
            value={selectedTripId}
            onChange={(event) => onSelectTrip(event.target.value)}
          >
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {tripRouteLabel(trip)} - {formatDateTime(trip.departure_datetime)}
              </option>
            ))}
          </select>
          {seats.length === 0 ? <EmptyState text="Seat belum tersedia untuk perjalanan ini." /> : null}
          <div className="grid max-w-xl grid-cols-4 gap-3">
            {seats.map((seat) => (
              <button
                key={seat.id}
                className={cn(
                  "grid aspect-square place-items-center rounded-md text-sm font-extrabold transition hover:scale-105",
                  seat.status === "available" && "bg-white text-[#113d7a] ring-1 ring-sky-200",
                  seat.status === "locked" && "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
                  seat.status === "booked" && "bg-slate-300 text-slate-600",
                )}
                type="button"
              >
                {seat.seat_number}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan seat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SeatMetric label="Available" value={available} tone="green" />
          <SeatMetric label="Locked" value={locked} tone="amber" />
          <SeatMetric label="Booked" value={booked} tone="slate" />
        </CardContent>
      </Card>
    </div>
  );
}

function SeatMetric({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "slate" }) {
  const color = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <div className={cn("rounded-md p-4", color)}>
      <p className="text-xs font-bold uppercase tracking-widest opacity-75">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
    </div>
  );
}
