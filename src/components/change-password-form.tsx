"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "@/app/(auth)/actions";
import { Button, Field, FormError, Input } from "./ui";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const form = useRef<HTMLFormElement>(null);
  const ok = state?.fields?.ok === "1";
  useEffect(() => {
    if (ok) form.current?.reset();
  }, [ok, state]);
  const f = state?.fields ?? {};
  return (
    <form ref={form} action={action} className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-3"><FormError message={state?.error} /></div>
      <Field label="كلمة المرور الحالية" error={f.current}>
        <Input name="current" type="password" autoComplete="current-password" dir="ltr" required aria-invalid={!!f.current} />
      </Field>
      <Field label="كلمة المرور الجديدة" error={f.password} hint="8 أحرف على الأقل">
        <Input name="password" type="password" autoComplete="new-password" dir="ltr" minLength={8} required aria-invalid={!!f.password} />
      </Field>
      <Field label="تأكيد كلمة المرور الجديدة" error={f.confirm}>
        <Input name="confirm" type="password" autoComplete="new-password" dir="ltr" minLength={8} required aria-invalid={!!f.confirm} />
      </Field>
      <div className="flex items-center gap-3 md:col-span-3">
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? "جارٍ الحفظ..." : "تغيير كلمة المرور"}</Button>
        {ok && <span role="status" className="text-sm font-semibold text-green">تم تغيير كلمة المرور</span>}
      </div>
    </form>
  );
}
