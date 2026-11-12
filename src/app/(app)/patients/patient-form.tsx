"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Card, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { BLOOD_TYPES } from "@/lib/labels";
import type { Patient } from "@/lib/supabase/types";
import { savePatient } from "./actions";

export function PatientForm({ patient, then }: { patient?: Patient; then?: string }) {
  const [state, action, pending] = useActionState(savePatient, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-5">
      {patient && <input type="hidden" name="id" value={patient.id} />}
      {then && <input type="hidden" name="then" value={then} />}
      <FormError message={state?.error} />

      <Card className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
        <h2 className="text-base font-bold md:col-span-2">المعلومات الأساسية</h2>
        <Field label="الاسم الكامل" error={f.full_name} className="md:col-span-2">
          <Input name="full_name" required defaultValue={patient?.full_name} aria-invalid={!!f.full_name} />
        </Field>
        <Field label="الجنس" error={f.gender}>
          <Select name="gender" required defaultValue={patient?.gender ?? ""} aria-invalid={!!f.gender}>
            <option value="" disabled>اختر</option>
            <option value="female">أنثى</option>
            <option value="male">ذكر</option>
          </Select>
        </Field>
        <Field label="تاريخ الميلاد" error={f.birth_date} hint="اختياري">
          <Input name="birth_date" type="date" defaultValue={patient?.birth_date ?? ""} max={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="رقم الهاتف" error={f.phone} hint="اختياري">
          <Input name="phone" type="tel" dir="ltr" defaultValue={patient?.phone ?? ""} />
        </Field>
        <Field label="زمرة الدم" error={f.blood_type} hint="اختياري">
          <Select name="blood_type" defaultValue={patient?.blood_type ?? ""}>
            <option value="">غير معروفة</option>
            {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Field>
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
        <h2 className="text-base font-bold md:col-span-2">المعلومات الطبية</h2>
        <Field label="الحساسية" hint="افصل بينها بفاصلة، مثل: بنسلين، سلفا">
          <Input name="allergies" defaultValue={patient?.allergies.join("، ")} />
        </Field>
        <Field label="الأمراض المزمنة" hint="افصل بينها بفاصلة">
          <Input name="chronic_conditions" defaultValue={patient?.chronic_conditions.join("، ")} />
        </Field>
        <Field label="ملاحظات" className="md:col-span-2">
          <Textarea name="notes" defaultValue={patient?.notes ?? ""} />
        </Field>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="min-w-36">{pending ? "جارٍ الحفظ..." : "حفظ"}</Button>
        <Link href={patient ? `/patients/${patient.id}` : "/patients"} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-muted hover:bg-chip">
          إلغاء
        </Link>
      </div>
    </form>
  );
}
