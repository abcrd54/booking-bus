import type { ApiBooking } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "./empty-state";
import { currency } from "./utils";

export function BookingsPanel({ bookings }: { bookings: ApiBooking[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking & transaksi</CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? <EmptyState text="Belum ada booking." /> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="py-3">Kode</th>
                <th>User</th>
                <th>Rute</th>
                <th>Total</th>
                <th>Status booking</th>
                <th>Status bayar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="py-4 font-bold">{booking.booking_code}</td>
                  <td>{booking.profiles?.name ?? booking.profiles?.email ?? "-"}</td>
                  <td>
                    {booking.trips?.routes?.origin_city ?? "-"} - {booking.trips?.routes?.destination_city ?? "-"}
                  </td>
                  <td>{currency(Number(booking.total_amount))}</td>
                  <td><Badge variant={booking.booking_status === "paid" ? "success" : "warning"}>{booking.booking_status}</Badge></td>
                  <td><Badge variant={booking.payment_status === "settlement" ? "success" : "outline"}>{booking.payment_status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
