"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import type { FormState } from "@/lib/forms";

export function AuthForm({
  mode,
  action,
  next,
}: {
  mode: "login" | "signup";
  action: (s: FormState, f: FormData) => Promise<FormState>;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const login = mode === "login";
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-[26px] font-extrabold">{login ? "تسجيل الدخول" : "إنشاء حساب"}</h1>
        <p className="mt-2 text-sm text-muted">{login ? "مرحباً بعودتك إلى نبض" : "ابدأ بإدارة عيادتك خلال دقائق"}</p>
      </div>
      <FormError message={state?.error} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="البريد الإلكتروني" error={state?.fields?.email}>
        <Input name="email" type="email" autoComplete="email" dir="ltr" required aria-invalid={!!state?.fields?.email} />
      </Field>
      <Field label="كلمة المرور" error={state?.fields?.password} hint={login ? undefined : "8 أحرف على الأقل"}>
        <Input
          name="password"
          type="password"
          autoComplete={login ? "current-password" : "new-password"}
          dir="ltr"
          required
          minLength={8}
          aria-invalid={!!state?.fields?.password}
        />
      </Field>
      <Button type="submit" disabled={pending} className="mt-2 h-12">
        {pending ? "لحظة..." : login ? "دخول" : "إنشاء الحساب"}
      </Button>
      <p className="text-center text-sm text-muted">
        {login ? "ليس لديك حساب؟ " : "لديك حساب؟ "}
        <Link href={login ? "/signup" : "/login"} className="font-semibold">
          {login ? "أنشئ حساباً" : "سجّل الدخول"}
        </Link>
      </p>
    </form>
  );
}
