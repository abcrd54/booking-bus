import type { ApiArmada } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "./empty-state";

export function FleetPanel({ armadas }: { armadas: ApiArmada[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manajemen armada</CardTitle>
      </CardHeader>
      <CardContent>
        {armadas.length === 0 ? <EmptyState text="Belum ada data armada." /> : null}
        <div className="grid gap-3">
          {armadas.map((armada) => (
            <div key={armada.id} className="grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{armada.armada_code}</Badge>
                  <Badge variant="outline">{armada.service_type}</Badge>
                  <Badge variant={armada.is_active ? "success" : "muted"}>{armada.is_active ? "aktif" : "nonaktif"}</Badge>
                </div>
                <h3 className="mt-3 font-display text-xl font-extrabold">{armada.name}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {armada.plate_number} - {armada.class_type} - {armada.seat_capacity} seat - {armada.seat_layout_template}
                </p>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
                  <span className="rounded-md bg-slate-50 px-2 py-1">Seat: {armada.seat_configuration ?? "-"}</span>
                  <span className="rounded-md bg-slate-50 px-2 py-1">Range: {armada.estimated_seat_range ?? "-"}</span>
                  <span className="rounded-md bg-slate-50 px-2 py-1">Toilet: {armada.toilet_location ?? "-"}</span>
                </div>
              </div>
              <Badge variant="outline">{armada.facilities?.length ?? 0} fasilitas</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
