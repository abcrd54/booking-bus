import type { ApiTrip } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "./empty-state";
import { currency, formatDateTime, occupancy, tripRouteLabel } from "./utils";

export function TripsPanel({ trips }: { trips: ApiTrip[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manajemen perjalanan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {trips.length === 0 ? <EmptyState text="Belum ada data perjalanan." /> : null}
        {trips.map((trip) => {
          const tripOccupancy = occupancy(trip);
          return (
            <div key={trip.id} className="grid gap-4 rounded-lg border border-slate-200 p-4 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge>{trip.status}</Badge>
                  <Badge variant="outline">{trip.armada.class_type}</Badge>
                </div>
                <h3 className="font-display text-xl font-extrabold">{tripRouteLabel(trip)} - {trip.armada.name}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDateTime(trip.departure_datetime)} - {formatDateTime(trip.arrival_datetime)} - {currency(Number(trip.price))}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-md bg-slate-100">
                  <div className="h-full rounded-md bg-emerald-500" style={{ width: `${tripOccupancy}%` }} />
                </div>
              </div>
              <Badge variant="success">{tripOccupancy}%</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
