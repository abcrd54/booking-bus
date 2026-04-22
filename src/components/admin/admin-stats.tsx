import { BarChart3, CalendarClock, CheckCircle2, ClipboardList, MapPinned, Users } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import type { Summary } from "./types";

type AdminStatsProps = {
  summary: Summary | null;
  averageOccupancy: number;
  routeCount: number;
  loading: boolean;
};

export function AdminStats({ summary, averageOccupancy, routeCount, loading }: AdminStatsProps) {
  const stats = [
    [Users, "Total user", summary?.total_users ?? 0],
    [ClipboardList, "Booking hari ini", summary?.bookings_today ?? 0],
    [CheckCircle2, "Transaksi sukses", summary?.paid_today ?? 0],
    [BarChart3, "Occupancy", `${averageOccupancy}%`],
    [MapPinned, "Rute aktif", routeCount],
    [CalendarClock, "Perjalanan aktif", summary?.active_trips ?? 0],
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {stats.map(([Icon, label, value]) => (
        <Card key={label}>
          <CardContent className="p-4">
            <Icon className="mb-3 text-[#113d7a]" size={22} />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{loading ? "..." : value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
