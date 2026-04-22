import type { ApiSeat } from "../lib/api";
import { cn } from "../lib/utils";

type SeatMapProps = {
  seats: ApiSeat[];
  selectedSeatIds: string[];
  configuration?: string | null;
  onToggleSeat: (seatId: string) => void;
};

export function SeatMap({ seats, selectedSeatIds, configuration, onToggleSeat }: SeatMapProps) {
  const sortedSeats = [...seats].sort((a, b) => {
    const numberA = Number(a.seat_number.replace(/\D/g, ""));
    const numberB = Number(b.seat_number.replace(/\D/g, ""));
    if (Number.isFinite(numberA) && Number.isFinite(numberB) && numberA !== numberB) return numberA - numberB;
    if (a.seat_row !== b.seat_row) return a.seat_row - b.seat_row;
    return a.seat_col - b.seat_col;
  });
  const normalizedConfiguration = configuration?.replace(/\s/g, "") ?? "";
  const hasMultipleDecks = new Set(sortedSeats.map((seat) => seat.deck || 1)).size > 1;
  const useCoachLayout =
    hasMultipleDecks ||
    normalizedConfiguration.includes("2-2") ||
    normalizedConfiguration.includes("2-1") ||
    normalizedConfiguration.includes("1-1") ||
    sortedSeats.length >= 18;

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-800">Seat availability</p>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
          <span>Available</span>
          <span>Locked</span>
          <span>Booked</span>
        </div>
      </div>
      {seats.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-500">
          Seat belum tersedia untuk trip ini.
        </div>
      ) : null}
      {useCoachLayout ? (
        <VehicleSeatLayout
          seats={sortedSeats}
          selectedSeatIds={selectedSeatIds}
          configuration={configuration}
          onToggleSeat={onToggleSeat}
        />
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {sortedSeats.map((seat) => (
            <SeatButton key={seat.id} seat={seat} selected={selectedSeatIds.includes(seat.id)} onToggleSeat={onToggleSeat} />
          ))}
        </div>
      )}
    </div>
  );
}

function VehicleSeatLayout({ seats, selectedSeatIds, configuration, onToggleSeat }: SeatMapProps) {
  const decks = Array.from(new Set(seats.map((seat) => seat.deck || 1))).sort((a, b) => a - b);
  const maxSeatNumber = Math.max(
    ...seats.map((seat, index) => Number(seat.seat_number.replace(/\D/g, "")) || index + 1),
    0,
  );
  const normalizedConfiguration = configuration?.replace(/\s/g, "") ?? "";
  const title = normalizedConfiguration.includes("Variasi")
    ? `DOUBLE DECKER ${maxSeatNumber || seats.length} SEATS`
    : normalizedConfiguration.includes("2-1")
      ? `BUS AC ${maxSeatNumber || seats.length} SEATS (2-1)`
      : normalizedConfiguration.includes("1-1")
        ? `BUS AC ${maxSeatNumber || seats.length} SEATS (1-1)`
        : `BUS AC ${maxSeatNumber || seats.length} SEATS (2-2)`;

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-slate-300 bg-white p-4 shadow-inner">
      <div className="mb-4 text-center font-display text-base font-extrabold tracking-tight text-slate-950">
        {title}
      </div>
      <div className="mb-4 grid grid-cols-[1fr_0.7fr_1fr] gap-3 text-center text-xs font-extrabold text-slate-700">
        <div className="border border-slate-300 py-2">Kernet</div>
        <div className="border border-slate-300 py-2">CD</div>
        <div className="border border-slate-300 py-2">Sopir</div>
      </div>
      <div className="space-y-5">
        {decks.map((deck) => {
          const deckSeats = seats.filter((seat) => (seat.deck || 1) === deck);

          return (
            <div key={deck} className="space-y-3">
              {decks.length > 1 ? (
                <div className="rounded-md bg-slate-100 px-3 py-2 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-slate-600">
                  Dek {deck}
                </div>
              ) : null}
              <SeatRows seats={deckSeats} selectedSeatIds={selectedSeatIds} onToggleSeat={onToggleSeat} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeatRows({ seats, selectedSeatIds, onToggleSeat }: Omit<SeatMapProps, "configuration">) {
  const rows = Array.from(new Set(seats.map((seat) => seat.seat_row))).sort((a, b) => a - b);
  const maxCol = Math.max(...seats.map((seat) => seat.seat_col), 1);
  const seatByPosition = new Map(seats.map((seat) => [`${seat.seat_row}:${seat.seat_col}`, seat]));

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row}
          className="grid gap-0"
          style={{ gridTemplateColumns: `repeat(${maxCol}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: maxCol }, (_, index) => index + 1).map((col) => (
            <SeatSlot
              key={`${row}:${col}`}
              seat={seatByPosition.get(`${row}:${col}`)}
              selectedSeatIds={selectedSeatIds}
              onToggleSeat={onToggleSeat}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SeatSlot({
  seat,
  selectedSeatIds,
  onToggleSeat,
}: {
  seat?: ApiSeat;
  selectedSeatIds: string[];
  onToggleSeat: (seatId: string) => void;
}) {
  if (!seat) return <div className="min-h-11" />;

  return <SeatButton seat={seat} selected={selectedSeatIds.includes(seat.id)} onToggleSeat={onToggleSeat} square={false} />;
}

function SeatButton({
  seat,
  selected,
  onToggleSeat,
  square = true,
}: {
  seat: ApiSeat;
  selected: boolean;
  onToggleSeat: (seatId: string) => void;
  square?: boolean;
}) {
  return (
    <button
      disabled={seat.status !== "available"}
      className={cn(
        "grid place-items-center border border-slate-300 bg-white text-xs font-extrabold text-slate-900 transition hover:bg-sky-50 hover:text-[#113d7a]",
        square ? "aspect-square rounded-md" : "min-h-12",
        seat.status === "available" && "cursor-pointer",
        selected && "border-[#113d7a] bg-[#113d7a] text-white hover:bg-[#113d7a] hover:text-white",
        seat.status === "locked" && "cursor-not-allowed bg-amber-100 text-amber-700 hover:bg-amber-100 hover:text-amber-700",
        seat.status === "booked" && "cursor-not-allowed bg-slate-300 text-slate-600 hover:bg-slate-300 hover:text-slate-600",
      )}
      onClick={() => onToggleSeat(seat.id)}
      type="button"
    >
      {seat.seat_number}
    </button>
  );
}
