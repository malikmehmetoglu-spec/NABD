"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Card, Field, FormError, Input, Select } from "@/components/ui";
import { PatientPicker } from "@/components/patient-picker";
import { createAppointment } from "../actions";

type Props = {
  doctors: { user_id: string; full_name: string }[];
  defaultDoctor?: string;
  date: string;
  slot: number;
  patient: { id: string; full_name: string; phone: string | null; file_number: number } | null;
};

export function AppointmentForm({ doctors, defaultDoctor, date, slot, patient }: Props) {
  const [state, action, pending] = useActionState(createAppointment, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError message={state?.error} />
      <Card className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
        <Field label="المريض" error={f.patient_id} className="md:col-span-2">
          <PatientPicker initial={patient} invalid={!!f.patient_id} />
        </Field>
        <p className="-mt-2 text-xs text-muted md:col-span-2">
          مريض جديد؟ <Link href="/patients/new?then=appointment" className="font-semibold">أضفه أولاً</Link>
        </p>
        <Field label="التاريخ" error={f.date}>
          <Input type="date" name="date" required defaultValue={date} />
        </Field>
        <Field label="الوقت" error={f.time}>
          <Input type="time" name="time" required step={slot * 60} aria-invalid={!!f.time} />
        </Field>
        <Field label="المدة (دقيقة)" error={f.duration}>
          <Select name="duration" defaultValue={String(slot)}>
            {[...new Set([10, 15, 20, 30, 45, 60, 90, slot])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        {doctors.length > 1 ? (
          <Field label="الطبيب" error={f.doctor_id}>
            <Select name="doctor_id" defaultValue={defaultDoctor}>
              {doctors.map((d) => <option key={d.user_id} value={d.user_id}>{d.full_name}</option>)}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="doctor_id" value={defaultDoctor ?? ""} />
        )}
        <Field label="سبب الزيارة" hint="اختياري، مثل: مراجعة، كشف أول" className="md:col-span-2">
          <Input name="reason" maxLength={200} />
        </Field>
      </Card>
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="min-w-36">{pending ? "جارٍ الحجز..." : "حجز الموعد"}</Button>
        <Link href="/appointments" className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-muted hover:bg-chip">إلغاء</Link>
      </div>
    </form>
  );
}
