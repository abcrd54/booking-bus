import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Armchair,
  ArrowRight,
  Bus,
  CheckCircle2,
  Clock3,
  Headphones,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Settings,
  ShoppingCart,
  Route,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { DateField } from "./components/date-field";
import { SeatMap } from "./components/seat-map";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import {
  getRoutes,
  getTripSeats,
  login,
  register,
  ApiError,
  searchTrips,
  validateVoucher,
  type ApiProfile,
  type ApiRoute,
  type ApiSeat,
  type ApiSession,
  type ApiTrip,
  type ApiVoucher,
} from "./lib/api";
import { cn } from "./lib/utils";

const AdminDashboard = lazy(() =>
  import("./components/admin-dashboard").then((module) => ({ default: module.AdminDashboard })),
);

type UserRole = "user" | "admin";
type ActiveView = "public" | "booking" | "admin" | "login" | "verified";
type AuthMode = "login" | "register";

type Trip = {
  dbId?: string;
  id: string;
  routeCode?: string;
  origin: string;
  destination: string;
  originPoint?: string;
  destinationPoint?: string;
  serviceType: "bus" | "travel";
  depart: string;
  arrive: string;
  armadaCode?: string;
  classType: string;
  seatConfiguration?: string | null;
  estimatedSeatRange?: string | null;
  toiletLocation?: string | null;
  seatCapacity?: number;
  fleet: string;
  facilities: string[];
  price: number;
  seatsLeft: number;
  duration: string;
  status: "scheduled" | "popular";
  seatSummary?: {
    available: number;
    locked: number;
    booked: number;
  };
};

type CartItem = {
  trip: Trip;
  seats: ApiSeat[];
};

const CART_STORAGE_KEY = "maju-jaya-cart";

const heroImage =
  "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&fm=webp&q=72&w=2200";

const bookingSteps = [
  ["Cek jadwal", "Cari rute, tanggal, dan jumlah kursi."],
  ["Pilih perjalanan", "Bandingkan kelas armada, harga, dan sisa kursi."],
  ["Pilih kursi", "Seat dikunci sementara saat proses pembayaran."],
  ["Bayar", "Selesaikan pembayaran melalui metode yang tersedia."],
  ["Terima tiket", "E-ticket aktif setelah status booking paid."],
];

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours}j ${remainingMinutes}m` : `${hours}j`;
}

function mapApiTrip(trip: ApiTrip): Trip {
  return {
    dbId: trip.id,
    id: `TR-${trip.id.slice(0, 8).toUpperCase()}`,
    routeCode: trip.route.route_code,
    origin: trip.route.origin_city,
    destination: trip.route.destination_city,
    originPoint: trip.route.origin_point,
    destinationPoint: trip.route.destination_point,
    serviceType: trip.route.service_type,
    depart: formatTime(trip.departure_datetime),
    arrive: formatTime(trip.arrival_datetime),
    armadaCode: trip.armada.armada_code,
    classType: trip.armada.class_type,
    seatConfiguration: trip.armada.seat_configuration,
    estimatedSeatRange: trip.armada.estimated_seat_range,
    toiletLocation: trip.armada.toilet_location,
    seatCapacity: trip.armada.seat_capacity,
    fleet: trip.armada.name,
    facilities: trip.armada.facilities ?? [],
    price: Number(trip.price),
    seatsLeft: trip.seats_left,
    duration: formatDuration(trip.route.duration_minutes),
    status: trip.seats_left <= 12 ? "popular" : "scheduled",
    seatSummary: trip.seat_summary,
  };
}

function defaultTravelDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function viewFromPath(pathname: string): ActiveView {
  if (pathname === "/auth/verified") return "verified";
  if (pathname === "/login") return "login";
  if (pathname === "/admin") return "admin";
  return "public";
}

function App() {
  const [activeView, setActiveView] = useState<ActiveView>(() => viewFromPath(window.location.pathname));
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<ApiSession | null>(null);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [origin, setOrigin] = useState("Jakarta");
  const [destination, setDestination] = useState("Yogyakarta");
  const [serviceType, setServiceType] = useState<"bus" | "travel">("bus");
  const [travelDate, setTravelDate] = useState(defaultTravelDate);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [remoteTrips, setRemoteTrips] = useState<Trip[]>([]);
  const [popularRoutes, setPopularRoutes] = useState<ApiRoute[]>([]);
  const [tripSeats, setTripSeats] = useState<ApiSeat[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [cartItem, setCartItem] = useState<CartItem | null>(() => {
    try {
      const cached = window.localStorage.getItem(CART_STORAGE_KEY);
      return cached ? (JSON.parse(cached) as CartItem) : null;
    } catch {
      return null;
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "connected" | "error">("idle");

  useEffect(() => {
    let isActive = true;

    searchTrips({ origin, destination, date: travelDate, service_type: serviceType })
      .then(({ trips: apiTrips }) => {
        if (!isActive) return;

        const mappedTrips = apiTrips.map(mapApiTrip);
        setRemoteTrips(mappedTrips);
        setSelectedTrip(mappedTrips[0] ?? null);
        setApiStatus("connected");
      })
      .catch(() => {
        if (!isActive) return;
        setRemoteTrips([]);
        setSelectedTrip(null);
        setApiStatus("error");
      });

    return () => {
      isActive = false;
    };
  }, [destination, origin, serviceType, travelDate]);

  useEffect(() => {
    let isActive = true;

    getRoutes()
      .then(({ routes }) => {
        if (!isActive) return;
        setPopularRoutes(routes);
      })
      .catch(() => {
        if (!isActive) return;
        setPopularRoutes([]);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTrip?.dbId) {
      setTripSeats([]);
      return;
    }

    let isActive = true;

    getTripSeats(selectedTrip.dbId)
      .then(({ seats }) => {
        if (!isActive) return;
        setTripSeats(seats);
      })
      .catch(() => {
        if (!isActive) return;
        setTripSeats([]);
      });

    return () => {
      isActive = false;
    };
  }, [selectedTrip?.dbId]);

  useEffect(() => {
    function handlePopState() {
      setActiveView(viewFromPath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    setSelectedSeatIds([]);
  }, [selectedTrip?.dbId]);

  useEffect(() => {
    if (!cartItem) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItem));
  }, [cartItem]);

  const filteredTrips = useMemo(() => {
    return remoteTrips.filter((trip) => {
      const originMatch = trip.origin.toLowerCase().includes(origin.toLowerCase());
      const destinationMatch = trip.destination.toLowerCase().includes(destination.toLowerCase());
      return originMatch && destinationMatch;
    });
  }, [destination, origin, remoteTrips]);

  function navigate(view: ActiveView, nextAuthMode: AuthMode = "login") {
    setActiveView(view);

    if (view === "login") {
      setAuthMode(nextAuthMode);
      window.history.pushState({}, "", "/login");
      return;
    }

    if (view === "admin") {
      window.history.pushState({}, "", "/admin");
      return;
    }

    window.history.pushState({}, "", "/");
  }

  function handleLogin(nextSession: ApiSession, nextProfile: ApiProfile) {
    setSession(nextSession);
    setProfile(nextProfile);
    navigate(nextProfile.role === "admin" ? "admin" : "public");
  }

  function addSelectedSeatsToCart() {
    if (!selectedTrip) return;

    const selectedSeats = tripSeats.filter((seat) => selectedSeatIds.includes(seat.id));
    if (selectedSeats.length === 0) return;

    setCartItem({ trip: selectedTrip, seats: selectedSeats });
    setCartOpen(true);
  }

  if (activeView === "login") {
    return (
      <LoginPage
        initialMode={authMode}
        onLogin={handleLogin}
        onBack={() => navigate("public")}
      />
    );
  }

  if (activeView === "verified") {
    return <VerificationStatusPage onGoHome={() => navigate("public")} onGoLogin={() => navigate("login")} />;
  }

  if (activeView === "admin") {
    if (profile?.role !== "admin") {
      return (
        <LoginPage
          initialMode="login"
          onLogin={handleLogin}
          onBack={() => navigate("public")}
        />
      );
    }

    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
        <Header
          activeView={activeView}
          isLoggedIn={session !== null}
          role={profile?.role ?? null}
          onNavigate={navigate}
          onLogout={() => {
            setSession(null);
            setProfile(null);
            navigate("public");
          }}
        />
        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl px-4 py-16 text-sm font-semibold text-slate-600 sm:px-6 lg:px-8">
              Memuat dashboard admin...
            </div>
          }
        >
          <AdminDashboard token={session?.access_token ?? ""} />
        </Suspense>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <div className="md:hidden">
        <MobileAppComingSoon />
      </div>
      <div className="hidden md:block">
        <Header
          activeView={activeView}
          isLoggedIn={session !== null}
          role={profile?.role ?? null}
          onNavigate={navigate}
          onLogout={() => {
            setSession(null);
            setProfile(null);
            navigate("public");
          }}
        />
        <Hero
          destination={destination}
          origin={origin}
          serviceType={serviceType}
          routes={popularRoutes}
          travelDate={travelDate}
          onDateChange={setTravelDate}
          onDestinationChange={setDestination}
          onOriginChange={setOrigin}
          onServiceTypeChange={setServiceType}
          onLoginClick={() => navigate("login")}
          onSearch={() => navigate("booking")}
        />
        <TrustSection />
        <section id="jadwal" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <SchedulePanel
              apiStatus={apiStatus}
              trips={filteredTrips}
              selectedTrip={selectedTrip}
              onSelectTrip={(trip) => {
                setSelectedTrip(trip);
                navigate("booking");
              }}
            />
            <TripDetail
              trip={selectedTrip}
              seats={tripSeats}
              selectedSeatIds={selectedSeatIds}
              onToggleSeat={(seatId) =>
                setSelectedSeatIds((current) =>
                  current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId],
                )
              }
              onAddToCart={addSelectedSeatsToCart}
            />
          </div>
        </section>
        <PopularRoutes routes={popularRoutes} />
        <FeatureSection />
        <FleetTrustSection />
        <TestimonialsSection />
        <AboutSection />
        <BookingFlow />
        <Footer />
        {cartItem ? (
          <CartLauncher itemCount={cartItem.seats.length} total={cartItem.trip.price * cartItem.seats.length} onClick={() => setCartOpen(true)} />
        ) : null}
        <BookingCartDrawer
          cartItem={cartItem}
          open={cartOpen}
          profile={profile}
          isLoggedIn={session !== null}
          onClose={() => setCartOpen(false)}
          onClear={() => {
            setCartItem(null);
            setCartOpen(false);
          }}
          onLoginRequired={() => {
            setCartOpen(false);
            navigate("login");
          }}
        />
      </div>
    </main>
  );
}

function Header({
  activeView,
  isLoggedIn,
  role,
  onNavigate,
  onLogout,
}: {
  activeView: ActiveView;
  isLoggedIn: boolean;
  role: UserRole | null;
  onNavigate: (view: ActiveView, nextAuthMode?: AuthMode) => void;
  onLogout: () => void;
}) {
  const nav = [
    ["#jadwal", "Booking"],
    ["#layanan", "Service"],
    ["#tentang", "Tentang PO"],
    ["#kontak", "Kontak"],
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button className="flex items-center gap-3" onClick={() => onNavigate("public")}>
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#113d7a] text-white">
            <Bus size={21} />
          </span>
          <span className="font-display text-lg font-extrabold tracking-wide text-[#113d7a]">
            MAJU JAYA
          </span>
        </button>
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map(([href, label]) => (
            <a
              key={href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#113d7a]"
              href={href}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <AccountMenu role={role} onNavigate={onNavigate} onLogout={onLogout} />
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("login")}>
                <LogIn size={16} />
                Login
              </Button>
              <Button size="sm" onClick={() => onNavigate("login", "register")}>
                Daftar
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="md:hidden" aria-label="Menu">
            <Menu size={22} />
          </Button>
        </div>
      </div>
    </header>
  );
}

function AccountMenu({
  role,
  onNavigate,
  onLogout,
}: {
  role: UserRole | null;
  onNavigate: (view: ActiveView) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((current) => !current)}>
        <span className="grid h-6 w-6 place-items-center rounded-md bg-[#113d7a] text-xs font-extrabold text-white">
          {role === "admin" ? "A" : "U"}
        </span>
        Akun
      </Button>
      {open ? (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <button
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onNavigate(role === "admin" ? "admin" : "booking");
            }}
          >
            <Ticket size={16} />
            {role === "admin" ? "Dashboard Admin" : "Tiket Saya"}
          </button>
          <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Settings size={16} />
            Pengaturan
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MobileAppComingSoon() {
  return (
    <section className="min-h-screen bg-[#081526] px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-amber-400 text-[#081526]">
              <Bus size={22} />
            </span>
            <span className="font-display text-xl font-extrabold">MAJU JAYA</span>
          </div>

          <div className="mt-12">
            <Badge variant="warning">Aplikasi mobile segera hadir</Badge>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-tight">
              Booking bus dan travel lebih nyaman lewat aplikasi.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-300">
              Website mobile sedang kami arahkan ke pengalaman aplikasi agar pencarian jadwal, pilih kursi, voucher, dan tiket tersimpan lebih praktis.
            </p>
          </div>

          <div className="mt-8 grid gap-3">
            <button className="flex h-14 items-center justify-center gap-3 rounded-lg bg-white text-sm font-extrabold text-slate-950 opacity-90" type="button">
              <ShoppingCart size={18} /> Download di Play Store
            </button>
            <button className="flex h-14 items-center justify-center gap-3 rounded-lg border border-white/20 bg-white/10 text-sm font-extrabold text-white" type="button">
              <Ticket size={18} /> Download di App Store
            </button>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Coming soon</p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-3">
          {[
            ["Seat", "Real-time"],
            ["Tiket", "Tersimpan"],
            ["Promo", "Voucher"],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-white/10 bg-white/10 p-3">
              <p className="font-display text-xl font-extrabold text-amber-200">{title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-300">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LoginPage({
  initialMode,
  onLogin,
  onBack,
}: {
  initialMode: AuthMode;
  onLogin: (session: ApiSession, profile: ApiProfile) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError("");
    setNotice("");
  }, [initialMode]);

  async function submitLogin() {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const data = await login({ email, password });
      onLogin(data.session, data.profile);
    } catch (loginError) {
      setError(loginError instanceof ApiError ? `Login gagal: ${loginError.message}` : "Login gagal. Periksa email dan password.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister() {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const result = await register({ email, password, name, phone, address });

      if (result.session) {
        const data = await login({ email, password });
        onLogin(data.session, data.profile);
        return;
      }

      setNotice("Pendaftaran berhasil. Cek email kamu jika verifikasi akun aktif, lalu login.");
      setMode("login");
    } catch (registerError) {
      setError(
        registerError instanceof ApiError
          ? `Pendaftaran gagal: ${registerError.message}`
          : "Pendaftaran gagal. Pastikan data valid dan email belum terdaftar.",
      );
    } finally {
      setLoading(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <main className="grid min-h-screen bg-[#081526] px-4 py-10 text-white lg:grid-cols-[1fr_480px]">
      <section className="relative hidden overflow-hidden rounded-lg lg:block">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={heroImage}
          alt="Bus Maju Jaya"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#081526]/90 via-[#081526]/55 to-transparent" />
        <div className="relative z-10 flex h-full max-w-2xl flex-col justify-end p-10">
          <Badge variant="warning" className="mb-5 w-fit">/login</Badge>
          <h1 className="font-display text-5xl font-extrabold leading-tight">Satu pintu login untuk user dan admin.</h1>
          <p className="mt-5 leading-8 text-slate-200">
            Masuk sebagai pelanggan atau admin dari halaman yang sama.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center">
        <Card className="w-full max-w-md border-white/15 bg-white text-slate-950">
          <CardHeader>
            <Badge variant="default" className="w-fit">{isRegister ? "Daftar akun" : "Login akun"}</Badge>
            <CardTitle className="text-3xl">{isRegister ? "Buat akun MAJU JAYA" : "Masuk ke MAJU JAYA"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isRegister ? (
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Nama lengkap</span>
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Email</span>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {isRegister ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">No HP</span>
                  <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Alamat</span>
                  <Input value={address} onChange={(event) => setAddress(event.target.value)} />
                </label>
              </div>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Password</span>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              {isRegister
                ? "Buat akun untuk memesan dan menyimpan tiket perjalanan."
                : "Admin akan diarahkan ke dashboard, pelanggan masuk ke area website."}
            </div>
            {error ? <div className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
            {notice ? <div className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}
            <Button
              className="w-full"
              onClick={isRegister ? submitRegister : submitLogin}
              disabled={!email || !password || (isRegister && !name) || loading}
            >
              {loading ? "Memproses..." : isRegister ? "Daftar" : "Masuk"}
            </Button>
            {isRegister ? (
              <p className="text-center text-sm text-slate-600">
                Sudah punya akun?{" "}
                <button className="font-bold text-[#113d7a] hover:underline" onClick={() => setMode("login")}>
                  Login
                </button>
              </p>
            ) : (
              <p className="text-center text-sm text-slate-600">
                Belum punya akun?{" "}
                <button className="font-bold text-[#113d7a] hover:underline" onClick={() => setMode("register")}>
                  Daftar
                </button>
              </p>
            )}
            <button className="text-sm font-semibold text-slate-500 hover:text-[#113d7a]" onClick={onBack}>
              Kembali ke website
            </button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Hero({
  destination,
  origin,
  routes,
  travelDate,
  serviceType,
  onDateChange,
  onDestinationChange,
  onOriginChange,
  onServiceTypeChange,
  onLoginClick,
  onSearch,
}: {
  destination: string;
  origin: string;
  routes: ApiRoute[];
  travelDate: string;
  serviceType: "bus" | "travel";
  onDateChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onOriginChange: (value: string) => void;
  onServiceTypeChange: (value: "bus" | "travel") => void;
  onLoginClick: () => void;
  onSearch: () => void;
}) {
  const serviceRoutes = routes.filter((route) => route.service_type === serviceType);
  const routeAvailable =
    origin.trim() === "" ||
    destination.trim() === "" ||
    serviceRoutes.some(
      (route) =>
        route.origin_city.toLowerCase() === origin.trim().toLowerCase() &&
        route.destination_city.toLowerCase() === destination.trim().toLowerCase(),
    );

  return (
    <section className="relative min-h-[680px] overflow-hidden">
      <img className="absolute inset-0 h-full w-full object-cover" src={heroImage} alt="Bus premium di jalan antar kota" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,18,38,0.88),rgba(6,18,38,0.5),rgba(6,18,38,0.08))]" />
      <div className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="max-w-3xl"
        >
          <Badge variant="warning" className="mb-5">Booking bus dan travel terintegrasi</Badge>
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-white md:text-7xl">
            Pesan perjalanan tanpa antre, kursi terkunci real-time.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
            Cek jadwal, pilih kursi, dan pantau status tiket dari satu tempat.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={onSearch}>
              Cek Jadwal <ArrowRight size={18} />
            </Button>
            <Button size="lg" variant="secondary" onClick={onLoginClick}>
              Login / Daftar
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.16, duration: 0.65 }}
          className="rounded-lg border border-white/30 bg-white/82 p-3 shadow-2xl backdrop-blur-2xl"
        >
          <div className="rounded-md bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-600">Cari cepat</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-950">Jadwal perjalanan</h2>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-md bg-sky-50 text-[#113d7a]">
                <Route size={22} />
              </span>
            </div>
            <div className="grid gap-3">
              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Jenis layanan</span>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                  {(["bus", "travel"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={cn(
                        "rounded-md px-3 py-2 text-sm font-extrabold capitalize transition",
                        serviceType === type ? "bg-[#113d7a] text-white shadow-sm" : "text-slate-600 hover:bg-white",
                      )}
                      onClick={() => onServiceTypeChange(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <RouteCombobox
                icon={<MapPin size={18} />}
                label="Asal"
                value={origin}
                routes={serviceRoutes}
                type="origin"
                onChange={onOriginChange}
              />
              <RouteCombobox
                icon={<MapPin size={18} />}
                label="Tujuan"
                value={destination}
                origin={origin}
                routes={serviceRoutes}
                type="destination"
                onChange={onDestinationChange}
              />
              <DateField value={travelDate} onChange={onDateChange} />
              {!routeAvailable ? (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  Maaf rute yang kamu masukkan belum tersedia.
                </div>
              ) : null}
              <Button className="mt-2 w-full" onClick={onSearch}>
                Search Trips <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function RouteCombobox({
  icon,
  label,
  value,
  routes,
  type,
  origin,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  routes: ApiRoute[];
  type: "origin" | "destination";
  origin?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const source = useMemo(() => {
    const routePool =
      type === "destination" && origin?.trim()
        ? routes.filter((route) => route.origin_city.toLowerCase() === origin.trim().toLowerCase())
        : routes;
    const cityList = routePool.map((route) => (type === "origin" ? route.origin_city : route.destination_city));

    return Array.from(new Set(cityList)).sort((left, right) => left.localeCompare(right));
  }, [origin, routes, type]);
  const suggestions = source.filter((city) => city.toLowerCase().includes(normalizedValue));
  const shouldShowEmpty = open && value.trim() !== "" && suggestions.length === 0;

  return (
    <label className="relative block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#113d7a]">{icon}</span>
        <Input
          className="pl-10 font-semibold"
          value={value}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={type === "origin" ? "Pilih atau ketik kota asal" : "Pilih atau ketik kota tujuan"}
        />
      </span>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          {suggestions.length > 0 ? (
            suggestions.slice(0, 6).map((city) => (
              <button
                key={city}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-sky-50 hover:text-[#113d7a]"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(city);
                  setOpen(false);
                }}
              >
                <span>{city}</span>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  {type === "origin" ? "Asal" : "Tujuan"}
                </span>
              </button>
            ))
          ) : shouldShowEmpty ? (
            <div className="px-4 py-3 text-sm font-semibold text-amber-700">
              Maaf rute yang kamu masukkan belum tersedia.
            </div>
          ) : (
            <div className="px-4 py-3 text-sm font-semibold text-slate-500">
              Rute belum tersedia.
            </div>
          )}
        </div>
      ) : null}
    </label>
  );
}

function SchedulePanel({
  apiStatus,
  trips,
  selectedTrip,
  onSelectTrip,
}: {
  apiStatus: "idle" | "connected" | "error";
  trips: Trip[];
  selectedTrip: Trip | null;
  onSelectTrip: (trip: Trip) => void;
}) {
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null);

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#113d7a]">Hasil pencarian</p>
              <CardTitle className="mt-1 text-2xl">Jadwal tersedia</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={apiStatus === "connected" ? "success" : apiStatus === "error" ? "warning" : "outline"}>
                {apiStatus === "connected" ? "Jadwal tersedia" : apiStatus === "error" ? "Jadwal belum tersedia" : "Memuat"}
              </Badge>
              <Badge variant="outline">{trips.length} perjalanan</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {trips.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="font-display text-xl font-extrabold text-slate-900">
                {apiStatus === "connected" ? "Tidak ada rute tersedia" : "Belum ada jadwal"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {apiStatus === "connected"
                  ? "Tidak ada jadwal untuk asal, tujuan, atau tanggal yang kamu pilih."
                  : "Coba beberapa saat lagi atau hubungi admin."}
              </p>
            </div>
          ) : null}
          {trips.map((trip) => (
            <div
              key={trip.id}
              className={cn(
                "grid w-full gap-4 rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md md:grid-cols-[1fr_auto]",
                selectedTrip?.id === trip.id ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white",
                trip.seatsLeft === 0 && "opacity-75 hover:translate-y-0 hover:shadow-none",
              )}
            >
              <button className="text-left" type="button" onClick={() => onSelectTrip(trip)} disabled={trip.seatsLeft === 0}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant={trip.seatsLeft === 0 ? "warning" : trip.status === "popular" ? "warning" : "muted"}>
                    {trip.seatsLeft === 0 ? "Full Booked" : trip.id}
                  </Badge>
                  <Badge variant="outline">{trip.classType}</Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
                  <TimeBlock city={trip.origin} time={trip.depart} />
                  <div className="hidden items-center gap-2 text-slate-400 sm:flex">
                    <span className="h-px w-14 bg-slate-300" />
                    <Bus size={18} />
                    <span className="h-px w-14 bg-slate-300" />
                  </div>
                  <TimeBlock city={trip.destination} time={trip.arrive} align="right" />
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                  <span className="flex items-center gap-1.5"><Clock3 size={16} /> {trip.duration}</span>
                  <span className="flex items-center gap-1.5">
                    <Armchair size={16} /> {trip.seatsLeft === 0 ? "Tidak ada kursi tersedia" : `Sisa ${trip.seatsLeft} kursi`}
                  </span>
                  <span className="flex items-center gap-1.5"><Bus size={16} /> {trip.fleet}</span>
                </div>
              </button>
              <div className="flex items-end justify-between gap-4 md:flex-col md:items-end">
                <span className="font-display text-2xl font-extrabold text-[#113d7a]">{rupiah(trip.price)}</span>
                <Button size="sm" variant="secondary" onClick={() => setDetailTrip(trip)}>
                  Detail
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {detailTrip ? <TripInfoModal trip={detailTrip} onClose={() => setDetailTrip(null)} /> : null}
    </>
  );
}

function TripInfoModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <Badge variant="outline" className="mb-3">{trip.serviceType}</Badge>
            <h3 className="font-display text-3xl font-extrabold text-slate-950">{trip.origin} - {trip.destination}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">{trip.routeCode ?? trip.id}</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-xl font-bold text-slate-600 hover:bg-slate-200" type="button" onClick={onClose}>
            x
          </button>
        </div>
        <div className="grid gap-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <SpecCard label="Berangkat" value={`${trip.depart} - ${trip.originPoint ?? trip.origin}`} />
            <SpecCard label="Tiba" value={`${trip.arrive} - ${trip.destinationPoint ?? trip.destination}`} />
            <SpecCard label="Durasi" value={trip.duration} />
            <SpecCard label="Harga" value={rupiah(trip.price)} />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge>{trip.armadaCode ?? "Armada"}</Badge>
              <Badge variant="outline">{trip.classType}</Badge>
            </div>
            <h4 className="font-display text-2xl font-extrabold text-slate-950">{trip.fleet}</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SpecCard label="Konfigurasi Seat" value={trip.seatConfiguration ?? "-"} />
              <SpecCard label="Kapasitas" value={trip.seatCapacity ? `${trip.seatCapacity} seat` : trip.estimatedSeatRange ?? "-"} />
              <SpecCard label="Estimasi Seat" value={trip.estimatedSeatRange ?? "-"} />
              <SpecCard label="Lokasi Toilet" value={trip.toiletLocation ?? "-"} />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Fitur & kelebihan</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(trip.facilities.length > 0 ? trip.facilities : ["AC", "Kursi nyaman", "Armada terjadwal"]).map((facility) => (
                <Badge key={facility} variant="outline">{facility}</Badge>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-sky-50 p-4">
            <p className="text-sm font-semibold text-slate-600">Ketersediaan</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-[#113d7a]">
              {trip.seatsLeft === 0 ? "Full Booked" : `${trip.seatsLeft} kursi tersedia`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeBlock({ city, time, align = "left" }: { city: string; time: string; align?: "left" | "right" }) {
  return (
    <div className={cn(align === "right" && "sm:text-right")}>
      <p className="font-display text-3xl font-extrabold text-slate-950">{time}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">{city}</p>
    </div>
  );
}

function TripDetail({
  trip,
  seats,
  selectedSeatIds,
  onToggleSeat,
  onAddToCart,
}: {
  trip: Trip | null;
  seats: ApiSeat[];
  selectedSeatIds: string[];
  onToggleSeat: (seatId: string) => void;
  onAddToCart: () => void;
}) {
  if (!trip) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-8 text-center">
          <p className="font-display text-xl font-extrabold">Detail perjalanan belum tersedia</p>
          <p className="mt-2 text-sm text-slate-600">Pilih jadwal untuk melihat detail perjalanan.</p>
        </CardContent>
      </Card>
    );
  }

  const summary = trip.seatSummary ?? {
    available: seats.filter((seat) => seat.status === "available").length,
    locked: seats.filter((seat) => seat.status === "locked").length,
    booked: seats.filter((seat) => seat.status === "booked").length,
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative h-52">
        <img
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&fm=webp&q=72&w=1000"
          alt="Rute perjalanan antar kota"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 to-transparent" />
        <div className="absolute bottom-5 left-5 text-white">
          <p className="text-sm font-semibold text-amber-200">Detail perjalanan</p>
          <h2 className="font-display text-3xl font-extrabold">
            {trip.origin} - {trip.destination}
          </h2>
        </div>
      </div>
      <CardContent className="p-5">
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Available" value={String(summary.available)} tone="green" />
          <Metric label="Locked" value={String(summary.locked)} tone="amber" />
          <Metric label="Booked" value={String(summary.booked)} tone="slate" />
        </div>
        <SeatMap
          seats={seats}
          selectedSeatIds={selectedSeatIds}
          configuration={trip.seatConfiguration}
          onToggleSeat={onToggleSeat}
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SpecCard label="Kelas Bus" value={trip.classType} />
          <SpecCard label="Konfigurasi Seat" value={trip.seatConfiguration ?? "-"} />
          <SpecCard label="Estimasi Jumlah Seat" value={trip.estimatedSeatRange ?? (trip.seatCapacity ? `${trip.seatCapacity} Seat` : "-")} />
          <SpecCard label="Lokasi Toilet" value={trip.toiletLocation ?? "-"} />
        </div>
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">Seat dipilih</p>
              <p className="font-display text-2xl font-extrabold text-slate-950">
                {selectedSeatIds.length} kursi
              </p>
            </div>
            <Button disabled={selectedSeatIds.length === 0} onClick={onAddToCart}>
              <ShoppingCart size={18} />
              Lanjut booking
            </Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {["AC", "Reclining seat", "USB charger", "GPS tracking"].map((facility) => (
            <span key={facility} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              <CheckCircle2 className="text-emerald-600" size={17} /> {facility}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "slate" }) {
  const color = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <div className={cn("rounded-md p-3", color)}>
      <p className="text-xs font-bold uppercase tracking-widest opacity-75">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function SpecCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

const routeImages = [
  "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&fm=webp&q=72&w=1200",
  "https://images.unsplash.com/photo-1555620263-73c026840d83?auto=format&fit=crop&fm=webp&q=72&w=900",
  "https://images.unsplash.com/photo-1548013146-72479768bbaa?auto=format&fit=crop&fm=webp&q=72&w=900",
];

function PopularRoutes({ routes }: { routes: ApiRoute[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-600">Rute populer</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Destinasi favorit minggu ini</h2>
        </div>
        <Button variant="secondary">Lihat semua rute</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {routes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center md:col-span-3">
            <p className="font-display text-xl font-extrabold">Rute populer belum tersedia</p>
            <p className="mt-2 text-sm text-slate-600">Rute pilihan akan tampil saat jadwal tersedia.</p>
          </div>
        ) : null}
        {routes.slice(0, 3).map((route, index) => (
          <motion.article
            key={route.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ delay: index * 0.08 }}
            className="group relative min-h-80 overflow-hidden rounded-lg"
          >
            <img src={routeImages[index % routeImages.length]} alt={`${route.origin_city} ke ${route.destination_city}`} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <Badge variant="warning" className="mb-3">{route.route_code}</Badge>
              <h3 className="font-display text-2xl font-extrabold">{route.origin_city} - {route.destination_city}</h3>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-200"><Clock3 size={16} /> {formatDuration(route.duration_minutes)}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function TrustSection() {
  const stats = [
    ["120K+", "Penumpang terbantu"],
    ["98%", "Keberangkatan tepat jadwal"],
    ["24/7", "Bantuan operasional"],
    ["4.8/5", "Rating layanan"],
  ] as const;

  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="font-display text-4xl font-extrabold text-[#113d7a]">{value}</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            ["Manifest jelas", "Data penumpang dan seat tercatat rapi sebelum keberangkatan."],
            ["Armada terjadwal", "Setiap perjalanan memakai armada yang dipilih admin operasional."],
            ["Harga transparan", "Total, voucher, dan seat pilihan tampil sebelum pembayaran."],
          ].map(([title, body]) => (
            <div key={title} className="flex gap-3 rounded-lg border border-slate-200 p-4">
              <CheckCircle2 className="mt-1 text-emerald-600" size={20} />
              <div>
                <h3 className="font-display text-lg font-extrabold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  const features = [
    [ShieldCheck, "Pembayaran aman", "Status transaksi diperbarui otomatis setelah pembayaran."],
    [Armchair, "Seat real-time", "Ketersediaan kursi diperbarui langsung saat pemesanan."],
    [Headphones, "Support operasional", "Admin dapat memantau booking terbaru, pembayaran pending, dan occupancy."],
  ] as const;

  return (
    <section id="layanan" className="bg-white py-16">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
        {features.map(([Icon, title, body]) => (
          <Card key={title} className="border-slate-100">
            <CardContent className="p-6">
              <span className="mb-5 grid h-12 w-12 place-items-center rounded-md bg-sky-50 text-[#113d7a]">
                <Icon size={24} />
              </span>
              <h3 className="font-display text-xl font-extrabold">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function FleetTrustSection() {
  const classes = [
    ["Eksekutif", "2-2", "32-45 Seat", "Pilihan stabil untuk rute reguler harian."],
    ["Super Eksekutif", "2-1", "21-24 Seat", "Ruang duduk lebih lega untuk perjalanan jauh."],
    ["Sleeper / Suites", "1-1", "18-22 Seat", "Privasi dan kenyamanan lebih tinggi."],
    ["Double Decker", "Variasi", "50-70 Seat", "Kapasitas besar untuk rute ramai."],
  ] as const;

  return (
    <section className="bg-[#eef3f8] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#113d7a]">Kelas armada</p>
            <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Pilih kelas sesuai kebutuhan perjalanan.</h2>
          </div>
          <Badge variant="warning">Seat map sesuai armada</Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {classes.map(([name, config, seats, body]) => (
            <Card key={name} className="border-slate-200">
              <CardContent className="p-5">
                <Badge variant="outline">{config}</Badge>
                <h3 className="mt-4 font-display text-2xl font-extrabold">{name}</h3>
                <p className="mt-1 text-sm font-bold text-[#113d7a]">{seats}</p>
                <p className="mt-4 text-sm leading-6 text-slate-600">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const testimonials = [
    ["Rina P.", "Jakarta - Yogyakarta", "Pilih seat-nya jelas, jadi tidak perlu tanya ulang ke agen."],
    ["Agus S.", "Bandung - Jakarta", "Rute dan jam berangkat mudah dicek. Voucher langsung mengurangi total."],
    ["Dewi L.", "Semarang - Surabaya", "Detail armada membantu sebelum memilih kelas bus."],
  ] as const;

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-600">Kepercayaan penumpang</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Dibuat untuk keputusan booking yang lebih yakin.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map(([name, route, quote]) => (
            <Card key={name} className="border-slate-100">
              <CardContent className="p-6">
                <div className="mb-4 flex gap-1 text-amber-500">
                  {Array.from({ length: 5 }, (_, index) => (
                    <span key={index}>★</span>
                  ))}
                </div>
                <p className="leading-7 text-slate-700">"{quote}"</p>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="font-bold text-slate-950">{name}</p>
                  <p className="text-sm font-semibold text-slate-500">{route}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="tentang" className="bg-[#10233f] py-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <Badge variant="warning">Tentang PO</Badge>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight">PO Maju Jaya menghubungkan rute utama Jawa setiap hari.</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["20+", "Armada aktif"],
            ["12", "Rute reguler"],
            ["24/7", "Support perjalanan"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-lg border border-white/15 bg-white/10 p-5">
              <p className="font-display text-4xl font-extrabold text-amber-200">{value}</p>
              <p className="mt-2 text-sm font-semibold text-slate-200">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BookingFlow() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#113d7a]">Cara booking</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Dari jadwal sampai e-ticket.</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {bookingSteps.map(([title, body], index) => (
            <div key={title} className="rounded-lg border border-slate-200 bg-white p-4">
              <span className="mb-4 grid h-9 w-9 place-items-center rounded-md bg-[#113d7a] text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CartLauncher({ itemCount, total, onClick }: { itemCount: number; total: number; onClick: () => void }) {
  return (
    <button
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg bg-[#113d7a] px-4 py-3 text-left text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-[#0d3264]"
      type="button"
      onClick={onClick}
    >
      <span className="grid h-10 w-10 place-items-center rounded-md bg-white/15">
        <ShoppingCart size={20} />
      </span>
      <span>
        <span className="block text-xs font-bold uppercase tracking-widest text-sky-100">{itemCount} seat</span>
        <span className="block font-display text-lg font-extrabold">{rupiah(total)}</span>
      </span>
    </button>
  );
}

function BookingCartDrawer({
  cartItem,
  open,
  profile,
  isLoggedIn,
  onClose,
  onClear,
  onLoginRequired,
}: {
  cartItem: CartItem | null;
  open: boolean;
  profile: ApiProfile | null;
  isLoggedIn: boolean;
  onClose: () => void;
  onClear: () => void;
  onLoginRequired: () => void;
}) {
  const [passenger, setPassenger] = useState({
    name: "",
    address: "",
    phone: "",
    dropPoint: "",
    email: "",
  });
  const [useProfile, setUseProfile] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherResult, setVoucherResult] = useState<{ voucher: ApiVoucher; discount: number; total: number } | null>(null);
  const [voucherMessage, setVoucherMessage] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  function toggleUseProfile(checked: boolean) {
    setUseProfile(checked);

    if (checked && profile) {
      setPassenger((current) => ({
        ...current,
        name: profile.name ?? "",
        address: profile.address ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
      }));
    }
  }

  if (!open || !cartItem) return null;

  const total = cartItem.trip.price * cartItem.seats.length;
  const finalTotal = voucherResult ? voucherResult.total : total;
  const requiredComplete =
    passenger.name.trim() !== "" &&
    passenger.address.trim() !== "" &&
    passenger.phone.trim() !== "" &&
    passenger.dropPoint.trim() !== "";

  async function applyVoucher() {
    if (!cartItem || !voucherCode.trim()) return;

    setVoucherLoading(true);
    setVoucherMessage("");
    setVoucherResult(null);

    try {
      const result = await validateVoucher({
        code: voucherCode,
        subtotal: total,
        service_type: cartItem.trip.serviceType,
      });
      setVoucherResult(result);
      setVoucherMessage(`${result.voucher.code} berhasil dipakai.`);
    } catch (error) {
      setVoucherMessage(error instanceof ApiError ? error.message : "Voucher tidak valid.");
    } finally {
      setVoucherLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-950/60 backdrop-blur-sm" onMouseDown={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-5">
          <div>
            <Badge variant="warning">Keranjang booking</Badge>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-slate-950">
              {cartItem.trip.origin} - {cartItem.trip.destination}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {cartItem.trip.fleet} - {cartItem.trip.depart} - {cartItem.trip.arrive}
            </p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-xl font-bold text-slate-600 hover:bg-slate-200" type="button" onClick={onClose}>
            x
          </button>
        </div>

        <div className="grid gap-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryRow label="Seat" value={cartItem.seats.map((seat) => seat.seat_number).join(", ")} />
            <SummaryRow label="Harga/kursi" value={rupiah(cartItem.trip.price)} />
            <SummaryRow label="Kelas" value={cartItem.trip.classType} />
            <SummaryRow label="Subtotal" value={rupiah(total)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kode voucher</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input placeholder="Masukkan kode voucher" value={voucherCode} onChange={(event) => setVoucherCode(event.target.value.toUpperCase())} />
                <Button variant="secondary" onClick={applyVoucher} disabled={voucherLoading || !voucherCode.trim()}>
                  {voucherLoading ? "Cek..." : "Gunakan"}
                </Button>
              </div>
              {voucherMessage ? (
                <div className={cn("rounded-md p-3 text-sm font-semibold", voucherResult ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                  {voucherMessage}
                </div>
              ) : null}
              {voucherResult?.voucher.terms ? (
                <p className="rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">{voucherResult.voucher.terms}</p>
              ) : null}
              <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                <SummaryRow label="Diskon" value={voucherResult ? `- ${rupiah(voucherResult.discount)}` : "-"} />
                <SummaryRow label="Total bayar" value={rupiah(finalTotal)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data penumpang</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoggedIn ? (
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <input
                    className="mt-1 h-4 w-4 accent-[#113d7a]"
                    checked={useProfile}
                    type="checkbox"
                    onChange={(event) => toggleUseProfile(event.target.checked)}
                  />
                  <span>
                    <span className="block font-bold text-slate-900">Masukkan data saya sebagai penumpang</span>
                    <span className="block text-sm text-slate-600">Data akan diisi dari profil akun jika tersedia.</span>
                  </span>
                </label>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <PassengerField required label="Nama" value={passenger.name} onChange={(value) => setPassenger((current) => ({ ...current, name: value }))} />
                <PassengerField required label="No HP" value={passenger.phone} onChange={(value) => setPassenger((current) => ({ ...current, phone: value }))} />
              </div>
              <PassengerField required label="Alamat" value={passenger.address} onChange={(value) => setPassenger((current) => ({ ...current, address: value }))} />
              <PassengerField
                required
                label="Titik turun"
                placeholder="Terminal Lebakbulus, Bundaran Ngabul, Pool/Garasi PO"
                value={passenger.dropPoint}
                onChange={(value) => setPassenger((current) => ({ ...current, dropPoint: value }))}
              />
              <PassengerField label="Email" placeholder="Opsional" type="email" value={passenger.email} onChange={(value) => setPassenger((current) => ({ ...current, email: value }))} />

              {isLoggedIn ? (
                <Button className="w-full" disabled={!requiredComplete}>
                  Lanjut pembayaran - {rupiah(finalTotal)}
                </Button>
              ) : (
                <Button className="w-full" onClick={onLoginRequired}>
                  Masuk / daftar untuk melanjutkan
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={onClear}>
                Hapus keranjang
              </Button>
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  );
}

function CartSummary({
  cartItem,
  onCheckout,
  onClear,
}: {
  cartItem: CartItem;
  onCheckout: () => void;
  onClear: () => void;
}) {
  const total = cartItem.trip.price * cartItem.seats.length;

  return (
    <section className="border-y border-slate-200 bg-[#10233f] py-10 text-white">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto] md:items-center lg:px-8">
        <div>
          <Badge variant="warning">Keranjang booking</Badge>
          <h2 className="mt-3 font-display text-3xl font-extrabold">
            {cartItem.trip.origin} - {cartItem.trip.destination}
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            {cartItem.trip.fleet} · {cartItem.trip.depart} - {cartItem.trip.arrive} · Seat{" "}
            {cartItem.seats.map((seat) => seat.seat_number).join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg bg-white/10 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Total</p>
            <p className="font-display text-2xl font-extrabold">{rupiah(total)}</p>
          </div>
          <Button variant="accent" onClick={onCheckout}>
            Ke halaman booking
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onClear}>
            Hapus
          </Button>
        </div>
      </div>
    </section>
  );
}

function CheckoutPage({
  cartItem,
  profile,
  onBack,
}: {
  cartItem: CartItem | null;
  profile: ApiProfile | null;
  onBack: () => void;
}) {
  const [passenger, setPassenger] = useState({
    name: "",
    address: "",
    phone: "",
    dropPoint: "",
    email: "",
  });
  const [useProfile, setUseProfile] = useState(false);

  function toggleUseProfile(checked: boolean) {
    setUseProfile(checked);

    if (checked && profile) {
      setPassenger((current) => ({
        ...current,
        name: profile.name ?? "",
        address: profile.address ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
      }));
    }
  }

  if (!cartItem) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-8">
            <p className="font-display text-2xl font-extrabold">Keranjang booking kosong</p>
            <p className="mt-2 text-slate-600">Pilih rute dan seat tersedia terlebih dahulu.</p>
            <Button className="mt-5" onClick={onBack}>Kembali pilih jadwal</Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const total = cartItem.trip.price * cartItem.seats.length;
  const requiredComplete =
    passenger.name.trim() !== "" &&
    passenger.address.trim() !== "" &&
    passenger.phone.trim() !== "" &&
    passenger.dropPoint.trim() !== "";

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Badge variant="default">Halaman booking</Badge>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">Lengkapi data penumpang</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Data penumpang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <input
                className="mt-1 h-4 w-4 accent-[#113d7a]"
                checked={useProfile}
                type="checkbox"
                onChange={(event) => toggleUseProfile(event.target.checked)}
              />
              <span>
                <span className="block font-bold text-slate-900">Masukkan data saya sebagai penumpang</span>
                <span className="block text-sm text-slate-600">
                  Data nama, alamat, no HP, dan email akan diambil dari profil akun jika tersedia.
                </span>
              </span>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <PassengerField
                required
                label="Nama"
                value={passenger.name}
                onChange={(value) => setPassenger((current) => ({ ...current, name: value }))}
              />
              <PassengerField
                required
                label="No HP"
                value={passenger.phone}
                onChange={(value) => setPassenger((current) => ({ ...current, phone: value }))}
              />
            </div>
            <PassengerField
              required
              label="Alamat"
              value={passenger.address}
              onChange={(value) => setPassenger((current) => ({ ...current, address: value }))}
            />
            <PassengerField
              required
              label="Titik turun"
              placeholder="Terminal Lebakbulus, Bundaran Ngabul, Pool/Garasi PO"
              value={passenger.dropPoint}
              onChange={(value) => setPassenger((current) => ({ ...current, dropPoint: value }))}
            />
            <PassengerField
              label="Email"
              placeholder="Opsional"
              type="email"
              value={passenger.email}
              onChange={(value) => setPassenger((current) => ({ ...current, email: value }))}
            />

            <Button className="w-full" disabled={!requiredComplete}>
              Lanjut pembayaran
            </Button>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Ringkasan booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Rute</p>
              <p className="font-display text-2xl font-extrabold">
                {cartItem.trip.origin} - {cartItem.trip.destination}
              </p>
            </div>
            <SummaryRow label="Armada" value={`${cartItem.trip.fleet} · ${cartItem.trip.classType}`} />
            <SummaryRow label="Jadwal" value={`${cartItem.trip.depart} - ${cartItem.trip.arrive}`} />
            <SummaryRow label="Seat" value={cartItem.seats.map((seat) => seat.seat_number).join(", ")} />
            <SummaryRow label="Harga/kursi" value={rupiah(cartItem.trip.price)} />
            <div className="rounded-lg bg-[#113d7a] p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-sky-100">Total</p>
              <p className="font-display text-3xl font-extrabold">{rupiah(total)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function PassengerField({
  label,
  value,
  onChange,
  required = false,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </span>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="text-right font-bold text-slate-900">{value}</span>
    </div>
  );
}

function Footer() {
  return (
    <footer id="kontak" className="bg-[#081526] py-10 text-slate-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <p className="font-display text-xl font-extrabold text-white">MAJU JAYA</p>
          <p className="mt-2 text-sm">Jl. Raya Transit No. 28, Jakarta. Support: hello@majujaya.id</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span>Syarat & Ketentuan</span>
          <span>Privasi</span>
          <span>Instagram</span>
          <span>WhatsApp</span>
        </div>
      </div>
    </footer>
  );
}

function VerificationStatusPage({
  onGoHome,
  onGoLogin,
}: {
  onGoHome: () => void;
  onGoLogin: () => void;
}) {
  const [status, message] = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const error = query.get("error") ?? hash.get("error");
    const errorDescription = query.get("error_description") ?? hash.get("error_description");

    if (error) {
      return [
        "error",
        errorDescription
          ? decodeURIComponent(errorDescription)
          : "Verifikasi email gagal. Link mungkin sudah expired atau sudah pernah dipakai.",
      ] as const;
    }

    return ["success", "Email berhasil diverifikasi. Sekarang kamu bisa login dan lanjut booking."] as const;
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f9fc] px-4 py-10 text-slate-950">
      <Card className="w-full max-w-lg border-slate-200">
        <CardContent className="space-y-6 p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100">
            {status === "success" ? (
              <CheckCircle2 className="text-emerald-600" size={34} />
            ) : (
              <ShieldCheck className="text-amber-600" size={34} />
            )}
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">
              {status === "success" ? "Verifikasi Berhasil" : "Verifikasi Gagal"}
            </h1>
            <p className={cn("text-sm leading-6", status === "success" ? "text-slate-600" : "text-amber-700")}>{message}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={onGoLogin}>
              <LogIn size={16} />
              Login
            </Button>
            <Button variant="secondary" onClick={onGoHome}>
              Kembali ke Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default App;
