import { useEffect, useState } from "react";
import {
  createAdminScheduleTemplate,
  type ApiRoute,
  type ApiScheduleTemplate,
} from "../../lib/api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { EmptyState } from "./empty-state";
import { currency } from "./utils";

type TemplatesPanelProps = {
  token: string;
  routes: ApiRoute[];
  templates: ApiScheduleTemplate[];
  onCreated: (template: ApiScheduleTemplate) => void;
};

export function TemplatesPanel({ token, routes, templates, onCreated }: TemplatesPanelProps) {
  const [form, setForm] = useState({
    route_id: routes[0]?.id ?? "",
    template_code: "",
    name: "",
    schedule_type: "daily" as "daily" | "custom",
    departure_time: "07:30",
    arrival_time: "16:00",
    default_price: "250000",
    valid_from: "",
    valid_until: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!form.route_id && routes[0]?.id) {
      setForm((current) => ({ ...current, route_id: routes[0].id }));
    }
  }, [form.route_id, routes]);

  async function submit() {
    setMessage("");
    const result = await createAdminScheduleTemplate(token, {
      route_id: form.route_id,
      template_code: form.template_code,
      name: form.name,
      schedule_type: form.schedule_type,
      departure_time: form.departure_time,
      arrival_time: form.arrival_time,
      default_price: Number(form.default_price),
      valid_from: form.valid_from || undefined,
      valid_until: form.valid_until || undefined,
      is_active: true,
    });
    onCreated(result.schedule_template);
    setMessage("Template jadwal berhasil dibuat.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Tambah template jadwal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" value={form.route_id} onChange={(event) => setForm({ ...form, route_id: event.target.value })}>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.route_code} - {route.origin_city} ke {route.destination_city} ({route.service_type})
              </option>
            ))}
          </select>
          <Input placeholder="Kode template, contoh TPL-JKT-YGY-0730" value={form.template_code} onChange={(event) => setForm({ ...form, template_code: event.target.value })} />
          <Input placeholder="Nama template" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <select className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" value={form.schedule_type} onChange={(event) => setForm({ ...form, schedule_type: event.target.value as "daily" | "custom" })}>
            <option value="daily">Daily</option>
            <option value="custom">Khusus</option>
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="time" value={form.departure_time} onChange={(event) => setForm({ ...form, departure_time: event.target.value })} />
            <Input type="time" value={form.arrival_time} onChange={(event) => setForm({ ...form, arrival_time: event.target.value })} />
          </div>
          <Input type="number" placeholder="Harga default" value={form.default_price} onChange={(event) => setForm({ ...form, default_price: event.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="date" value={form.valid_from} onChange={(event) => setForm({ ...form, valid_from: event.target.value })} />
            <Input type="date" value={form.valid_until} onChange={(event) => setForm({ ...form, valid_until: event.target.value })} />
          </div>
          {message ? <div className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</div> : null}
          <Button className="w-full" onClick={submit} disabled={!form.route_id || !form.template_code || !form.name}>
            Simpan template
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Template jadwal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? <EmptyState text="Belum ada template jadwal." /> : null}
          {templates.map((template) => (
            <div key={template.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{template.schedule_type}</Badge>
                <Badge variant="outline">{template.routes?.service_type ?? "-"}</Badge>
                <Badge variant={template.is_active ? "success" : "muted"}>{template.is_active ? "aktif" : "nonaktif"}</Badge>
              </div>
              <h3 className="mt-3 font-display text-xl font-extrabold">{template.name}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {template.routes?.origin_city} - {template.routes?.destination_city} - {template.departure_time} - {template.arrival_time} - {currency(Number(template.default_price))}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
