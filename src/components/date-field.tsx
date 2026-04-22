import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateField({ value, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 320 });
  const selectedDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(visibleMonth);
  const displayDate = value
    ? new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(selectedDate)
    : "Pilih tanggal";
  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return date;
    });
  }, [visibleMonth]);
  const todayValue = toDateValue(new Date());

  const syncPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gutter = 16;
    const panelHeight = 372;
    const width = Math.min(Math.max(rect.width, 320), window.innerWidth - gutter * 2);
    const left = Math.min(Math.max(rect.left, gutter), window.innerWidth - width - gutter);
    const hasRoomBelow = rect.bottom + panelHeight + gutter <= window.innerHeight;
    const top = hasRoomBelow ? rect.bottom + 8 : Math.max(gutter, rect.top - panelHeight - 8);

    setPosition({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;

    syncPosition();
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [open, syncPosition]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const calendarPanel = open
    ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[1000] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-2xl"
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              className="grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
              type="button"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              <ChevronLeft size={18} />
            </button>
            <p className="font-display text-base font-extrabold text-slate-950">{monthLabel}</p>
            <button
              className="grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
              type="button"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const dateValue = toDateValue(date);
              const isSelected = dateValue === value;
              const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
              const isPast = dateValue < todayValue;

              return (
                <button
                  key={dateValue}
                  className={cn(
                    "grid aspect-square place-items-center rounded-md text-sm font-bold transition",
                    isCurrentMonth ? "text-slate-800" : "text-slate-300",
                    !isPast && "hover:bg-sky-50 hover:text-[#113d7a]",
                    isSelected && "bg-[#113d7a] text-white hover:bg-[#113d7a] hover:text-white",
                    isPast && "cursor-not-allowed text-slate-300 opacity-50",
                  )}
                  disabled={isPast}
                  type="button"
                  onClick={() => {
                    onChange(dateValue);
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Tanggal</span>
      <button
        ref={triggerRef}
        className="grid h-14 w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left shadow-sm transition hover:border-sky-300 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        type="button"
        onClick={() => {
          syncPosition();
          setOpen((current) => !current);
        }}
      >
        <span className="grid h-9 w-9 place-items-center rounded-md bg-sky-50 text-[#113d7a]">
          <CalendarDays size={18} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-slate-950">{displayDate}</span>
          <span className="block text-xs font-semibold text-slate-500">Tanggal keberangkatan</span>
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-widest text-slate-500">
          Pilih
        </span>
      </button>
      {calendarPanel}
    </div>
  );
}
