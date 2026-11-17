"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input, LinkButton, Select } from "@/components/ui";
import { CURRENCIES, SPECIALTIES } from "@/lib/labels";
import type { Plan } from "@/lib/supabase/types";
import { createClinicAccount } from "../../actions";
import { Credentials } from "../../credentials";

export function NewClinicForm({ plans, defaultExpiry }: { plans: Plan[]; defaultExpiry: string }) {
  const [state, action, pending] = useActionState(createClinicAccount, undefined);
  const f = state?.fields ?? {};

  if (f.ok === "1" && f.email && f.password) {
    return (
      <div className="flex flex-col gap-4">
        <Credentials name={f.name ?? ""} email={f.email} password={f.password} title="أُنشئت العيادة وحساب مالكها" />
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/admin/clinics/${f.clinic_id}`}>فتح صفحة العيادة</LinkButton>
          <LinkButton href="/admin" variant="secondary">كل العيادات</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><FormError message={state?.error} /></div>
      <Field label="اسم العيادة" error={f.clinic_name} className="md:col-span-2">
        <Input name="clinic_name" required aria-invalid={!!f.clinic_name} />
      </Field>
      <Field label="اسم الطبيب المالك" error={f.owner_name}>
        <Input name="owner_name" required placeholder="د. ..." aria-invalid={!!f.owner_name} />
      </Field>
      <Field label="بريد المالك (للدخول)" error={f.email}>
        <Input name="email" type="email" dir="ltr" required autoComplete="off" aria-invalid={!!f.email} />
      </Field>
      <Field label="هاتف العيادة" error={f.phone} hint="اختياري">
        <Input name="phone" type="tel" dir="ltr" />
      </Field>
      <Field label="الاختصاص" error={f.specialty}>
        <Select name="specialty" defaultValue="general">
          {Object.entries(SPECIALTIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="عملة العيادة" error={f.currency}>
        <Select name="currency" defaultValue="SYP">
          {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
        </Select>
      </Field>
      <Field label="الخطة" error={f.plan}>
        <Select name="plan" defaultValue="trial">
          {plans.map((p) => (
            <option key={p.code} value={p.code}>{p.name} — {p.max_staff ?? "∞"} عضو، {p.max_patients ?? "∞"} مريض</option>
          ))}
        </Select>
      </Field>
      <Field label="ينتهي الاشتراك في" error={f.expires_on} hint="الافتراضي 14 يوماً للتجربة">
        <Input name="expires_on" type="date" dir="ltr" defaultValue={defaultExpiry} required />
      </Field>
      <div className="md:col-span-2">
        <Button type="submit" icon="plus" disabled={pending}>{pending ? "جارٍ الإنشاء..." : "إنشاء العيادة وحساب المالك"}</Button>
        <p className="mt-2 text-xs text-muted">تُولَّد كلمة مرور عشوائية وتظهر لك بعد الإنشاء لإرسالها للعميل.</p>
      </div>
    </form>
  );
}
