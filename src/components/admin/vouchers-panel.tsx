import { useState } from "react";
import { createAdminVoucher, type ApiVoucher } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { EmptyState } from "./empty-state";
import { currency } from "./utils";

type VouchersPanelProps = {
  token: string;
  vouchers: ApiVoucher[];
  onCreated: (voucher: ApiVoucher) => void;
};

export function VouchersPanel({ token, vouchers, onCreated }: VouchersPanelProps) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    discount_type: "percent" as "fixed" | "percent",
    discount_value: "10",
    max_discount: "",
    min_order_amount: "0",
    quota: "",
    valid_from: "",
    valid_until: "",
    service_type: "" as "" | "bus" | "travel",
    terms: "",
  });
  const [message, setMessage] = useState("");

  async function submit() {
    setMessage("");
    const { voucher } = await createAdminVoucher(token, {
      code: form.code,
      name: form.name,
      description: form.description || undefined,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_discount: form.max_discount ? Number(form.max_discount) : null,
      min_order_amount: Number(form.min_order_amount || 0),
      quota: form.quota ? Number(form.quota) : null,
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      service_type: form.service_type || null,
      terms: form.terms || undefined,
      is_active: true,
    });

    onCreated(voucher);
    setMessage("Voucher berhasil dibuat.");
    setForm((current) => ({ ...current, code: "", name: "", description: "", terms: "" }));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Buat voucher</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Kode voucher, contoh HEMAT25" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />
          <Input placeholder="Nama voucher" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input placeholder="Deskripsi singkat" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" value={form.discount_type} onChange={(event) => setForm({ ...form, discount_type: event.target.value as "fixed" | "percent" })}>
              <option value="percent">Persen</option>
              <option value="fixed">Nominal</option>
            </select>
            <Input type="number" placeholder="Nilai diskon" value={form.discount_value} onChange={(event) => setForm({ ...form, discount_value: event.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="number" placeholder="Maks diskon" value={form.max_discount} onChange={(event) => setForm({ ...form, max_discount: event.target.value })} />
            <Input type="number" placeholder="Min transaksi" value={form.min_order_amount} onChange={(event) => setForm({ ...form, min_order_amount: event.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="number" placeholder="Kuota" value={form.quota} onChange={(event) => setForm({ ...form, quota: event.target.value })} />
            <select className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" value={form.service_type} onChange={(event) => setForm({ ...form, service_type: event.target.value as "" | "bus" | "travel" })}>
              <option value="">Semua layanan</option>
              <option value="bus">Bus</option>
              <option value="travel">Travel</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="datetime-local" value={form.valid_from} onChange={(event) => setForm({ ...form, valid_from: event.target.value })} />
            <Input type="datetime-local" value={form.valid_until} onChange={(event) => setForm({ ...form, valid_until: event.target.value })} />
          </div>
          <textarea
            className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400"
            placeholder="Syarat dan ketentuan"
            value={form.terms}
            onChange={(event) => setForm({ ...form, terms: event.target.value })}
          />
          {message ? <div className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</div> : null}
          <Button className="w-full" onClick={submit} disabled={!form.code || !form.name || !form.discount_value}>
            Simpan voucher
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar voucher</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {vouchers.length === 0 ? <EmptyState text="Belum ada voucher." /> : null}
          {vouchers.map((voucher) => (
            <div key={voucher.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{voucher.code}</Badge>
                <Badge variant={voucher.is_active ? "success" : "muted"}>{voucher.is_active ? "aktif" : "nonaktif"}</Badge>
                <Badge variant="outline">{voucher.service_type ?? "semua"}</Badge>
              </div>
              <h3 className="mt-3 font-display text-xl font-extrabold">{voucher.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{voucher.description ?? "-"}</p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <span>Diskon: {voucher.discount_type === "percent" ? `${voucher.discount_value}%` : currency(Number(voucher.discount_value))}</span>
                <span>Min: {currency(Number(voucher.min_order_amount))}</span>
                <span>Kuota: {voucher.quota ? `${voucher.used_count}/${voucher.quota}` : "Tanpa batas"}</span>
              </div>
              {voucher.terms ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{voucher.terms}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
