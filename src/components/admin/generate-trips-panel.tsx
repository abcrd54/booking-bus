import { useEffect, useState } from "react";
import {
  generateAdminTrips,
  type ApiArmada,
  type ApiScheduleTemplate,
} from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { EmptyState } from "./empty-state";

type GenerateTripsPanelProps = {
  token: string;
  templates: ApiScheduleTemplate[];
  armadas: ApiArmada[];
  onGenerated: () => void;
};

export function GenerateTripsPanel({ token, templates, armadas, onGenerated }: GenerateTripsPanelProps) {
  const [templateId, setTemplateId] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedArmadaIds, setSelectedArmadaIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const selectedTemplate = templates.find((template) => template.id === templateId);
  const compatibleArmadas = selectedTemplate
    ? armadas.filter((armada) => armada.service_type === selectedTemplate.routes?.service_type)
    : armadas;

  useEffect(() => {
    if (!templateId && templates[0]?.id) {
      setTemplateId(templates[0].id);
    }
  }, [templateId, templates]);

  async function submit() {
    if (!templateId || selectedArmadaIds.length === 0) return;

    const { result } = await generateAdminTrips(token, {
      schedule_template_id: templateId,
      service_date: serviceDate,
      armada_ids: selectedArmadaIds,
    });

    setMessage(`Generate selesai. Dibuat: ${result.created}, dilewati: ${result.skipped}${result.reason ? ` (${result.reason})` : ""}.`);
    onGenerated();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Generate perjalanan manual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <select className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" value={templateId} onChange={(event) => {
            setTemplateId(event.target.value);
            setSelectedArmadaIds([]);
          }}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <Input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} />
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Pilih armada manual</p>
            {compatibleArmadas.length === 0 ? <EmptyState text="Tidak ada armada yang cocok untuk jenis layanan template." /> : null}
            {compatibleArmadas.map((armada) => (
              <label key={armada.id} className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold">
                <input
                  className="h-4 w-4 accent-[#113d7a]"
                  type="checkbox"
                  checked={selectedArmadaIds.includes(armada.id)}
                  onChange={(event) =>
                    setSelectedArmadaIds((current) =>
                      event.target.checked ? [...current, armada.id] : current.filter((id) => id !== armada.id),
                    )
                  }
                />
                {armada.armada_code} - {armada.name}
              </label>
            ))}
          </div>
          {message ? <div className="rounded-md bg-sky-50 p-3 text-sm font-semibold text-sky-700">{message}</div> : null}
          <Button className="w-full" onClick={submit} disabled={!templateId || selectedArmadaIds.length === 0}>
            Generate trip
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Aturan generate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
          <p>Template daily hanya menentukan rute, jam default, dan harga default.</p>
          <p>Armada tidak otomatis mengikuti hari sebelumnya. Admin wajib memilih armada yang berangkat pada tanggal tersebut.</p>
          <p>Jika armada sudah punya trip yang bentrok pada jam yang sama, sistem melewati armada itu dan menghitungnya sebagai skipped.</p>
        </CardContent>
      </Card>
    </div>
  );
}
