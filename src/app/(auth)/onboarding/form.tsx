"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormError, Input, Select, cx } from "@/components/ui";
import { CURRENCIES, SPECIALTIES } from "@/lib/labels";
import { createClinic, joinClinic } from "./actions";

export function OnboardingForm() {
  const [mode, setMode] = useState<"create" | "join">("create");
  return (
    <div className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-[26px] font-extrabold">{mode === "create" ? "لنجهّز عيادتك" : "الانضمام إلى عيادة"}</h1>
        <p className="mt-2 text-sm text-muted">
          {mode === "create" ? "معلومات أساسية، ويمكنك تعديلها لاحقاً من الإعدادات." : "أدخل رمز الدعوة الذي أرسله لك مالك العيادة."}
        </p>
      </div>
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl border-[1.5px] border-line bg-white p-1">
        {(["create", "join"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cx("min-h-10 rounded-xl text-sm font-semibold", mode === m ? "bg-sky text-brand" : "text-muted")}
          >
            {m === "create" ? "عيادة جديدة" : "لدي رمز دعوة"}
          </button>
        ))}
      </div>
      {mode === "create" ? <CreateForm /> : <JoinForm />}
    </div>
  );
}

function CreateForm() {
  const [state, action, pending] = useActionState(createClinic, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <Field label="اسم العيادة" error={f.clinic_name}>
        <Input name="clinic_name" required placeholder="عيادة د. ..." aria-invalid={!!f.clinic_name} />
      </Field>
      <Field label="اسمك كما يظهر للمرضى" error={f.owner_name}>
        <Input name="owner_name" required placeholder="د. ..." aria-invalid={!!f.owner_name} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الاختصاص" error={f.specialty}>
          <Select name="specialty" defaultValue="general">
            {Object.entries(SPECIALTIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="العملة" error={f.currency}>
          <Select name="currency" defaultValue="SYP">
            {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="هاتف العيادة" hint="اختياري">
        <Input name="phone" type="tel" dir="ltr" autoComplete="tel" />
      </Field>
      <Button type="submit" disabled={pending} className="mt-2 h-12">{pending ? "لحظة..." : "إنشاء العيادة"}</Button>
    </form>
  );
}

function JoinForm() {
  const [state, action, pending] = useActionState(joinClinic, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <Field label="رمز الدعوة" error={f.code}>
        <Input name="code" required dir="ltr" maxLength={10} autoCapitalize="characters" className="text-center text-lg font-bold tracking-[.3em] uppercase" aria-invalid={!!f.code} />
      </Field>
      <Field label="اسمك الكامل" error={f.full_name}>
        <Input name="full_name" required aria-invalid={!!f.full_name} />
      </Field>
      <Button type="submit" disabled={pending} className="mt-2 h-12">{pending ? "لحظة..." : "انضمام"}</Button>
    </form>
  );
}
