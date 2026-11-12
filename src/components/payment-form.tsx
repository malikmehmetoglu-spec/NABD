"use client";

import { useActionState, useEffect, useRef } from "react";
import { recordPayment } from "@/app/(app)/patients/actions";
import { Button, Field, FormError, Input, Select } from "./ui";
import { PatientPicker } from "./patient-picker";

export function PaymentForm({ patientId, suggested }: { patientId?: string; suggested?: number }) {
  const [state, action, pending] = useActionState(recordPayment, undefined);
  const form = useRef<HTMLFormElement>(null);
  const ok = state?.fields?.ok === "1";
  useEffect(() => {
    if (ok) form.current?.reset();
  }, [ok, state]);
  const f = state?.fields ?? {};

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      {ok && <p role="status" className="rounded-xl bg-green-soft px-3 py-2 text-sm font-semibold text-green">تم تسجيل الدفعة</p>}
      {patientId ? (
        <input type="hidden" name="patient_id" value={patientId} />
      ) : (
        <Field label="المريض" error={f.patient_id}>
          <PatientPicker invalid={!!f.patient_id} />
        </Field>
      )}
      <div className="grid grid-cols-[1.4fr_1fr] gap-3">
        <Field label="المبلغ" error={f.amount}>
          <Input name="amount" type="number" inputMode="decimal" min="0" step="any" required dir="ltr" defaultValue={suggested && suggested > 0 ? suggested : undefined} aria-invalid={!!f.amount} />
        </Field>
        <Field label="الطريقة">
          <Select name="method" defaultValue="cash">
            <option value="cash">نقداً</option>
            <option value="card">بطاقة</option>
            <option value="transfer">تحويل</option>
          </Select>
        </Field>
      </div>
      <Field label="ملاحظة" hint="اختياري">
        <Input name="note" maxLength={300} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "جارٍ الحفظ..." : "تسجيل دفعة"}</Button>
    </form>
  );
}
