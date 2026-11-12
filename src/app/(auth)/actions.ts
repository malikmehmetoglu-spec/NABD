"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, type FormState } from "@/lib/forms";

const credentials = z.object({
  email: z.email("أدخل بريداً إلكترونياً صحيحاً").trim().toLowerCase(),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(72),
});

/** يقبل فقط مسارات داخلية لتجنب إعادة التوجيه إلى مواقع خارجية */
function safeNext(value: FormDataEntryValue | null) {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    return { error: error.code === "user_already_exists" ? "هذا البريد مسجل مسبقاً، سجّل الدخول" : "تعذر إنشاء الحساب، حاول مرة أخرى" };
  }
  // إذا كان تأكيد البريد مفعلاً في Supabase لا توجد جلسة بعد
  if (!data.session) return { error: "أرسلنا رابط تأكيد إلى بريدك. افتحه ثم سجّل الدخول." };
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
