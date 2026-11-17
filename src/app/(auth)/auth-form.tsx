"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import type { FormState } from "@/lib/forms";
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contact";

export function LoginForm({ action, next }: { action: (s: FormState, f: FormData) => Promise<FormState>; next?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-[26px] font-extrabold">تسجيل الدخول</h1>
        <p className="mt-2 text-sm text-muted">ادخل بالبريد وكلمة المرور اللذين أرسلهما لك فريق نبض</p>
      </div>
      <FormError message={state?.error} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="البريد الإلكتروني" error={state?.fields?.email}>
        <Input name="email" type="email" autoComplete="email" dir="ltr" required aria-invalid={!!state?.fields?.email} />
      </Field>
      <Field label="كلمة المرور" error={state?.fields?.password}>
        <Input name="password" type="password" autoComplete="current-password" dir="ltr" required aria-invalid={!!state?.fields?.password} />
      </Field>
      <Button type="submit" disabled={pending} className="mt-2 h-12">
        {pending ? "لحظة..." : "دخول"}
      </Button>
      <p className="text-center text-sm leading-7 text-muted">
        ليس لديك حساب؟ تواصل مع فريق نبض على واتساب
        <br />
        <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-semibold">{SUPPORT_WHATSAPP_DISPLAY}</a>
      </p>
    </form>
  );
}
