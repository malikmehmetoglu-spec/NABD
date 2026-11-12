"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Card, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { Icon } from "@/components/icons";
import { saveVisit } from "../actions";

type Props = { patientId: string; appointmentId?: string; complaint: string | null; defaultFee: number; allergies: string[] };

let seq = 0;
const newRow = () => ({ key: ++seq });

export function VisitForm({ patientId, appointmentId, complaint, defaultFee, allergies }: Props) {
  const [state, action, pending] = useActionState(saveVisit, undefined);
  const [rows, setRows] = useState([newRow()]);
  const [drugs, setDrugs] = useState<Record<number, string>>({});
  const f = state?.fields ?? {};

  // تنبيه فوري إذا تطابق اسم الدواء مع حساسية مسجلة
  const flagged = (name: string) => {
    const n = name.trim().toLowerCase();
    return n.length > 2 && allergies.some((a) => n.includes(a.toLowerCase()) || a.toLowerCase().includes(n));
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="appointment_id" value={appointmentId ?? ""} />
      <FormError message={state?.error} />

      <Card className="p-5 md:p-6">
        <h2 className="mb-4 text-base font-bold">العلامات الحيوية</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Field label="الانقباضي" error={f.bp_systolic}><Input name="bp_systolic" type="number" inputMode="numeric" dir="ltr" placeholder="120" /></Field>
          <Field label="الانبساطي" error={f.bp_diastolic}><Input name="bp_diastolic" type="number" inputMode="numeric" dir="ltr" placeholder="80" /></Field>
          <Field label="النبض" error={f.pulse}><Input name="pulse" type="number" inputMode="numeric" dir="ltr" /></Field>
          <Field label="الحرارة °م" error={f.temperature}><Input name="temperature" type="number" step="0.1" inputMode="decimal" dir="ltr" /></Field>
          <Field label="الوزن كغ" error={f.weight_kg}><Input name="weight_kg" type="number" step="0.1" inputMode="decimal" dir="ltr" /></Field>
        </div>
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
        <h2 className="text-base font-bold md:col-span-2">الفحص</h2>
        <Field label="الشكوى" error={f.complaint}><Textarea name="complaint" defaultValue={complaint ?? ""} /></Field>
        <Field label="التشخيص" error={f.diagnosis}><Textarea name="diagnosis" /></Field>
        <Field label="ملاحظات الطبيب" className="md:col-span-2"><Textarea name="notes" /></Field>
      </Card>

      <Card className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">الوصفة الطبية</h2>
          <span className="text-xs text-muted">اترك السطر فارغاً إن لم تكن هناك وصفة</span>
        </div>
        <div className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <div key={r.key} className="grid grid-cols-2 gap-2.5 rounded-2xl border-[1.5px] border-divider bg-canvas p-3 md:grid-cols-[2fr_1fr_1.3fr_1fr_auto]">
              <div className="col-span-2 md:col-span-1">
                <Input
                  name="drug"
                  placeholder={`الدواء ${i + 1}`}
                  aria-label={`اسم الدواء ${i + 1}`}
                  onChange={(e) => setDrugs((d) => ({ ...d, [r.key]: e.target.value }))}
                  aria-invalid={flagged(drugs[r.key] ?? "")}
                />
                {flagged(drugs[r.key] ?? "") && <p className="mt-1 text-xs font-semibold text-danger-ink">قد يتعارض مع حساسية المريض</p>}
              </div>
              <Input name="dose" placeholder="الجرعة" aria-label="الجرعة" />
              <Input name="frequency" placeholder="عدد المرات" aria-label="عدد المرات" />
              <Input name="duration" placeholder="المدة" aria-label="المدة" />
              <input type="hidden" name="instructions" value="" />
              <button
                type="button"
                aria-label="حذف الدواء"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
                className="grid size-11 place-items-center justify-self-end rounded-xl text-muted hover:bg-danger-soft hover:text-danger-ink"
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="soft" icon="plus" className="mt-3" onClick={() => setRows((rs) => [...rs, newRow()])}>إضافة دواء</Button>
        <Field label="تعليمات عامة للوصفة" className="mt-4"><Input name="rx_notes" /></Field>
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
        <h2 className="text-base font-bold md:col-span-3">المحاسبة</h2>
        <Field label="أجر الزيارة" error={f.fee}><Input name="fee" type="number" min="0" step="any" dir="ltr" required defaultValue={defaultFee} /></Field>
        <Field label="المدفوع الآن" error={f.paid} hint="اتركه فارغاً إن لم يُدفع شيء"><Input name="paid" type="number" min="0" step="any" dir="ltr" defaultValue={defaultFee || undefined} /></Field>
        <Field label="طريقة الدفع">
          <Select name="method" defaultValue="cash">
            <option value="cash">نقداً</option>
            <option value="card">بطاقة</option>
            <option value="transfer">تحويل</option>
          </Select>
        </Field>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="min-w-40">{pending ? "جارٍ الحفظ..." : "حفظ الزيارة"}</Button>
        <Link href={`/patients/${patientId}`} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-muted hover:bg-chip">إلغاء</Link>
      </div>
    </form>
  );
}
