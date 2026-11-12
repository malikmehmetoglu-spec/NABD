"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { CURRENCIES, SPECIALTIES, TIMEZONES } from "@/lib/labels";
import type { Clinic } from "@/lib/supabase/types";
import { updateClinic, updateMyName } from "./actions";

function Saved({ show }: { show: boolean }) {
  return show ? <span role="status" className="text-sm font-semibold text-green">تم الحفظ</span> : null;
}

export function ClinicForm({ clinic, readOnly }: { clinic: Clinic; readOnly: boolean }) {
  const [state, action, pending] = useActionState(updateClinic, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><FormError message={state?.error} /></div>
      <fieldset disabled={readOnly} className="contents">
        <Field label="اسم العيادة" error={f.name} className="md:col-span-2"><Input name="name" defaultValue={clinic.name} required /></Field>
        <Field label="الاختصاص" error={f.specialty}>
          <Select name="specialty" defaultValue={clinic.specialty}>
            {Object.entries(SPECIALTIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="العملة" error={f.currency}>
          <Select name="currency" defaultValue={clinic.currency}>
            {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </Select>
        </Field>
        <Field label="الهاتف" error={f.phone}><Input name="phone" type="tel" dir="ltr" defaultValue={clinic.phone ?? ""} /></Field>
        <Field label="المنطقة الزمنية" error={f.timezone} hint="تُحسب المواعيد والأيام بها">
          <Select name="timezone" defaultValue={clinic.timezone} dir="ltr">
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="العنوان" error={f.address} className="md:col-span-2"><Input name="address" defaultValue={clinic.address ?? ""} /></Field>
        <Field label="أجر الزيارة الافتراضي" error={f.default_fee}><Input name="default_fee" type="number" min="0" step="any" dir="ltr" defaultValue={clinic.default_fee} /></Field>
        <Field label="مدة الموعد الافتراضية (دقيقة)" error={f.slot_minutes}>
          <Select name="slot_minutes" defaultValue={String(clinic.slot_minutes)}>
            {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
      </fieldset>
      {!readOnly && (
        <div className="flex items-center gap-3 md:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</Button>
          <Saved show={f.ok === "1"} />
        </div>
      )}
    </form>
  );
}

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateMyName, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="اسمك كما يظهر في الوصفات" error={state?.fields?.full_name} className="min-w-60 flex-1">
        <Input name="full_name" defaultValue={name} required />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>حفظ</Button>
      <Saved show={state?.fields?.ok === "1"} />
    </form>
  );
}
