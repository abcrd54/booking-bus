import type { ApiTrip } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "./empty-state";
import type { Summary } from "./types";
import { currency, occupancy, tripRouteLabel } from "./utils";

type OverviewPanelProps = {
  trips: ApiTrip[];
  summary: Summary | null;
  averageOccupancy: number;
};

export function OverviewPanel({ trips, summary, averageOccupancy }: OverviewPanelProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Occupancy perjalanan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {trips.length === 0 ? <EmptyState text="Belum ada perjalanan." /> : null}
          {trips.map((trip) => {
            const tripOccupancy = occupancy(trip);
            return (
              <div key={trip.id}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-700">{tripRouteLabel(trip)} - {trip.armada.name}</span>
                  <span className="font-semibold text-slate-500">{tripOccupancy}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-md bg-slate-100">
                  <div className="h-full rounded-md bg-[#113d7a]" style={{ width: `${tripOccupancy}%` }} />
                </div>
              </div>
            );
          })}
          <div className="rounded-lg bg-sky-50 p-4">
            <p className="text-sm font-semibold text-slate-600">Rata-rata occupancy</p>
            <p className="font-display text-4xl font-extrabold text-[#113d7a]">{averageOccupancy}%</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pembayaran pending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(summary?.pending_payments ?? []).length === 0 ? <EmptyState text="Tidak ada pembayaran pending." /> : null}
          {(summary?.pending_payments ?? []).map((booking) => (
            <div key={booking.id} className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">{booking.booking_code}</span>
                <Badge variant="warning">{booking.payment_status}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">{currency(Number(booking.total_amount))}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
