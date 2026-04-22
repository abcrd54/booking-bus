import { useEffect, useMemo, useState } from "react";
import { Armchair, BarChart3, Bus, CalendarClock, ClipboardList, MapPinned, Percent, Plus, ReceiptText, Search, Users } from "lucide-react";
import {
  getAdminArmadas,
  getAdminBookings,
  getAdminRoutes,
  getAdminScheduleTemplates,
  getAdminSummary,
  getAdminTripSeats,
  getAdminTrips,
  getAdminUsers,
  getAdminVouchers,
  type ApiArmada,
  type ApiBooking,
  type ApiProfile,
  type ApiRoute,
  type ApiScheduleTemplate,
  type ApiSeat,
  type ApiTrip,
  type ApiVoucher,
} from "../lib/api";
import { cn } from "../lib/utils";
import { AdminStats } from "./admin/admin-stats";
import { BookingsPanel } from "./admin/bookings-panel";
import { FleetPanel } from "./admin/fleet-panel";
import { GenerateTripsPanel } from "./admin/generate-trips-panel";
import { OverviewPanel } from "./admin/overview-panel";
import { RoutesPanel } from "./admin/routes-panel";
import { SeatsPanel } from "./admin/seats-panel";
import { TemplatesPanel } from "./admin/templates-panel";
import { TripsPanel } from "./admin/trips-panel";
import type { Summary } from "./admin/types";
import { occupancy, tripRouteLabel } from "./admin/utils";
import { UsersPanel } from "./admin/users-panel";
import { VouchersPanel } from "./admin/vouchers-panel";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

type AdminTab = "overview" | "routes" | "fleet" | "templates" | "generate" | "vouchers" | "trips" | "seats" | "bookings" | "users";

const tabs: Array<{ id: AdminTab; label: string; icon: typeof BarChart3 }> = [
  { id: "overview", label: "Ringkasan", icon: BarChart3 },
  { id: "routes", label: "Rute", icon: MapPinned },
  { id: "fleet", label: "Armada", icon: Bus },
  { id: "templates", label: "Template", icon: ClipboardList },
  { id: "generate", label: "Generate", icon: Plus },
  { id: "vouchers", label: "Voucher", icon: Percent },
  { id: "trips", label: "Perjalanan", icon: CalendarClock },
  { id: "seats", label: "Seat", icon: Armchair },
  { id: "bookings", label: "Transaksi", icon: ReceiptText },
  { id: "users", label: "User", icon: Users },
];

export function AdminDashboard({ token }: { token: string }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [routes, setRoutes] = useState<ApiRoute[]>([]);
  const [armadas, setArmadas] = useState<ApiArmada[]>([]);
  const [templates, setTemplates] = useState<ApiScheduleTemplate[]>([]);
  const [vouchers, setVouchers] = useState<ApiVoucher[]>([]);
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [users, setUsers] = useState<ApiProfile[]>([]);
  const [seats, setSeats] = useState<ApiSeat[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Token admin belum tersedia. Silakan login ulang sebagai admin.");
      setLoading(false);
      return;
    }

    let isActive = true;
    setLoading(true);
    setError("");

    Promise.all([
      getAdminSummary(token),
      getAdminRoutes(token),
      getAdminArmadas(token),
      getAdminScheduleTemplates(token),
      getAdminVouchers(token),
      getAdminTrips(token),
      getAdminBookings(token),
      getAdminUsers(token),
    ])
      .then(([summaryData, routesData, armadasData, templatesData, vouchersData, tripsData, bookingsData, usersData]) => {
        if (!isActive) return;

        setSummary(summaryData);
        setRoutes(routesData.routes);
        setArmadas(armadasData.armadas);
        setTemplates(templatesData.schedule_templates);
        setVouchers(vouchersData.vouchers);
        setTrips(tripsData.trips);
        setBookings(bookingsData.bookings);
        setUsers(usersData.users);
        setSelectedTripId(tripsData.trips[0]?.id ?? "");
      })
      .catch(() => {
        if (!isActive) return;
        setError("Data admin gagal dimuat.");
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedTripId) {
      setSeats([]);
      return;
    }

    let isActive = true;

    getAdminTripSeats(token, selectedTripId)
      .then(({ seats }) => {
        if (!isActive) return;
        setSeats(seats);
      })
      .catch(() => {
        if (!isActive) return;
        setSeats([]);
      });

    return () => {
      isActive = false;
    };
  }, [selectedTripId, token]);

  const filteredRoutes = useMemo(
    () =>
      routes.filter((route) =>
        [route.route_code, route.origin_city, route.destination_city]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query, routes],
  );

  const filteredArmadas = useMemo(
    () =>
      armadas.filter((armada) =>
        [armada.armada_code, armada.name, armada.plate_number, armada.class_type]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [armadas, query],
  );

  const filteredTrips = useMemo(
    () =>
      trips.filter((trip) =>
        [tripRouteLabel(trip), trip.armada.name, trip.status].join(" ").toLowerCase().includes(query.toLowerCase()),
      ),
    [query, trips],
  );

  const averageOccupancy = Math.round(
    trips.reduce((total, trip) => total + occupancy(trip), 0) / Math.max(trips.length, 1),
  );

  return (
    <section className="bg-[#eef3f8] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="default">Admin dashboard</Badge>
            <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-950">
              Pusat operasional perjalanan
            </h2>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[248px_1fr]">
          <aside className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-bold text-slate-600 transition",
                    activeTab === tab.id ? "bg-[#113d7a] text-white shadow-sm" : "hover:bg-slate-50",
                  )}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </aside>

          <div className="space-y-5">
            <AdminStats
              summary={summary}
              averageOccupancy={averageOccupancy}
              routeCount={routes.length}
              loading={loading}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  className="pl-10"
                  placeholder="Cari data admin"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Badge variant="outline">Data operasional</Badge>
            </div>

            {activeTab === "overview" ? (
              <OverviewPanel trips={trips} summary={summary} averageOccupancy={averageOccupancy} />
            ) : null}
            {activeTab === "routes" ? <RoutesPanel routes={filteredRoutes} /> : null}
            {activeTab === "fleet" ? <FleetPanel armadas={filteredArmadas} /> : null}
            {activeTab === "templates" ? (
              <TemplatesPanel
                token={token}
                routes={routes}
                templates={templates}
                onCreated={(template) => setTemplates((current) => [template, ...current])}
              />
            ) : null}
            {activeTab === "generate" ? (
              <GenerateTripsPanel
                token={token}
                templates={templates}
                armadas={armadas}
                onGenerated={() => {
                  getAdminTrips(token).then(({ trips }) => setTrips(trips)).catch(() => undefined);
                }}
              />
            ) : null}
            {activeTab === "vouchers" ? (
              <VouchersPanel
                token={token}
                vouchers={vouchers}
                onCreated={(voucher) => setVouchers((current) => [voucher, ...current])}
              />
            ) : null}
            {activeTab === "trips" ? <TripsPanel trips={filteredTrips} /> : null}
            {activeTab === "seats" ? (
              <SeatsPanel trips={trips} seats={seats} selectedTripId={selectedTripId} onSelectTrip={setSelectedTripId} />
            ) : null}
            {activeTab === "bookings" ? <BookingsPanel bookings={bookings} /> : null}
            {activeTab === "users" ? <UsersPanel users={users} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
