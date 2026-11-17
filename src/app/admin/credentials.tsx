"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/** بيانات الدخول تُعرض مرة واحدة بعد الإنشاء أو إعادة التعيين، مع رسالة جاهزة للإرسال */
export function Credentials({ name, email, password, title = "بيانات الدخول" }: { name: string; email: string; password: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const message = [
    `مرحباً ${name}،`,
    "بيانات دخولك إلى نبض:",
    `الرابط: ${typeof window === "undefined" ? "" : window.location.origin}/login`,
    `البريد: ${email}`,
    `كلمة المرور: ${password}`,
    "يمكنك تغيير كلمة المرور من الإعدادات بعد الدخول.",
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div role="status" className="rounded-2xl border-[1.5px] border-green/30 bg-green-soft p-4">
      <div className="text-sm font-bold text-green">{title}</div>
      <p className="mt-1 text-xs text-muted">تظهر مرة واحدة فقط. انسخها وأرسلها الآن.</p>
      <dl className="mt-3 grid gap-2 text-sm">
        <div className="flex flex-wrap gap-2"><dt className="w-24 text-muted">البريد</dt><dd dir="ltr" className="font-semibold select-all">{email}</dd></div>
        <div className="flex flex-wrap gap-2"><dt className="w-24 text-muted">كلمة المرور</dt><dd dir="ltr" className="font-mono font-bold tracking-wide select-all">{password}</dd></div>
      </dl>
      <Button type="button" variant="secondary" onClick={copy} className="mt-3 min-h-10">
        {copied ? "تم النسخ" : "نسخ رسالة جاهزة للإرسال"}
      </Button>
    </div>
  );
}
