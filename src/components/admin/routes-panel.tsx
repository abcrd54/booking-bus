import type { ApiRoute } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "./empty-state";

export function RoutesPanel({ routes }: { routes: ApiRoute[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manajemen rute</CardTitle>
      </CardHeader>
      <CardContent>
        {routes.length === 0 ? <EmptyState text="Belum ada data rute." /> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="py-3">Kode</th>
                <th>Jenis</th>
                <th>Rute</th>
                <th>Titik</th>
                <th>Durasi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routes.map((route) => (
                <tr key={route.id}>
                  <td className="py-4 font-bold">{route.route_code}</td>
                  <td><Badge variant="outline">{route.service_type}</Badge></td>
                  <td>{route.origin_city} - {route.destination_city}</td>
                  <td className="max-w-[260px] text-slate-600">{route.origin_point} / {route.destination_point}</td>
                  <td>{route.duration_minutes} menit</td>
                  <td><Badge variant={route.is_active ? "success" : "muted"}>{route.is_active ? "aktif" : "nonaktif"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
