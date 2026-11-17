"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import type { Plan } from "@/lib/supabase/types";
import { deleteClinic, recordSubscriptionPayment, updateSubscription } from "../../actions";

function Saved({ show, text = "تم الحفظ" }: { show: boolean; text?: string }) {
  return show ? <span role="status" className="text-sm font-semibold text-green">{text}</span> : null;
}

function PlanSelect({ plans, value }: { plans: Plan[]; value: string }) {
  return (
    <Select name="plan" defaultValue={value}>
      {plans.map((p) => (
        <option key={p.code} value={p.code}>
          {p.name} — {p.max_staff ?? "∞"} عضو، {p.max_patients ?? "∞"} مريض
        </option>
      ))}
    </Select>
  );
}

export function SubscriptionForm(props: {
  clinicId: string;
  plans: Plan[];
  plan: string;
  status: "active" | "suspended";
  expiresOn: string;
  maxStaffOverride: number | null;
  maxPatientsOverride: number | null;
}) {
  const [state, action, pending] = useActionState(updateSubscription, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><FormError message={state?.error} /></div>
      <input type="hidden" name="clinic_id" value={props.clinicId} />
      <Field label="الخطة" error={f.plan}><PlanSelect plans={props.plans} value={props.plan} /></Field>
      <Field label="الحالة" hint="المعلّقة لا يرى أعضاؤها أي بيانات">
        <Select name="status" defaultValue={props.status}>
          <option value="active">فعّالة</option>
          <option value="suspended">معلّقة</option>
        </Select>
      </Field>
      <Field label="ينتهي الاشتراك في" error={f.expires_on} hint="بعده تصبح العيادة للقراءة فقط">
        <Input name="expires_on" type="date" dir="ltr" defaultValue={props.expiresOn} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="حد الطاقم الخاص" error={f.max_staff_override} hint="فارغ = حد الخطة">
          <Input name="max_staff_override" type="number" min="1" dir="ltr" defaultValue={props.maxStaffOverride ?? ""} />
        </Field>
        <Field label="حد المرضى الخاص" error={f.max_patients_override} hint="فارغ = حد الخطة">
          <Input name="max_patients_override" type="number" min="1" dir="ltr" defaultValue={props.maxPatientsOverride ?? ""} />
        </Field>
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "جارٍ الحفظ..." : "حفظ الاشتراك"}</Button>
        <Saved show={f.ok === "1"} />
      </div>
    </form>
  );
}

export function PaymentForm({ clinicId, plans, plan }: { clinicId: string; plans: Plan[]; plan: string }) {
  const [state, action, pending] = useActionState(recordSubscriptionPayment, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><FormError message={state?.error} /></div>
      <input type="hidden" name="clinic_id" value={clinicId} />
      <Field label="الخطة" error={f.plan}><PlanSelect plans={plans} value={plan} /></Field>
      <Field label="المدة" error={f.months}>
        <Select name="months" defaultValue="12">
          <option value="1">شهر</option>
          <option value="3">3 أشهر</option>
          <option value="6">6 أشهر</option>
          <option value="12">سنة</option>
          <option value="24">سنتان</option>
        </Select>
      </Field>
      <div className="grid grid-cols-[1.4fr_1fr] gap-3">
        <Field label="المبلغ" error={f.amount}>
          <Input name="amount" type="number" min="0" step="any" dir="ltr" required aria-invalid={!!f.amount} />
        </Field>
        <Field label="العملة">
          <Select name="currency" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="TRY">TRY</option>
            <option value="SYP">SYP</option>
          </Select>
        </Field>
      </div>
      <Field label="ملاحظة" hint="اختياري، مثل طريقة الدفع"><Input name="note" maxLength={300} /></Field>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "جارٍ التسجيل..." : "تسجيل الدفعة وتمديد الاشتراك"}</Button>
        <Saved show={f.ok === "1"} text="سُجّلت الدفعة ومُدّد الاشتراك" />
      </div>
      <p className="text-xs text-muted md:col-span-2">
        يُمدَّد الاشتراك من تاريخ انتهائه الحالي، أو من اليوم إن كان منتهياً.
      </p>
    </form>
  );
}

export function DeleteClinicForm({ clinicId, name }: { clinicId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteClinic, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <input type="hidden" name="clinic_id" value={clinicId} />
      <Field label={`للتأكيد اكتب اسم العيادة: ${name}`} error={f.confirm_name}>
        <Input name="confirm_name" autoComplete="off" required aria-invalid={!!f.confirm_name} />
      </Field>
      <Button type="submit" variant="danger" icon="trash" disabled={pending} className="w-fit">
        {pending ? "جارٍ الحذف..." : "حذف العيادة وكل بياناتها نهائياً"}
      </Button>
    </form>
  );
}
