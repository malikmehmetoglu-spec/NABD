"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, type FormState } from "@/lib/forms";

const credentials = z.object({
  email: z.email("أدخل بريداً إلكترونياً صحيحاً").trim().toLowerCase(),
  password: z.string().min(1, "أدخل كلمة المرور").max(72),
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


export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "أدخل كلمة المرور الحالية"),
    password: z.string().min(8, "8 أحرف على الأقل").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "لا تطابق كلمة المرور الجديدة" })
  .refine((d) => d.password !== d.current, { path: ["password"], message: "اختر كلمة مرور مختلفة عن الحالية" });

/** تغيير كلمة المرور للمستخدم الحالي، بعد التحقق من كلمته الحالية */
export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) redirect("/login");

  const check = await supabase.auth.signInWithPassword({ email: data.user.email, password: parsed.data.current });
  if (check.error) return { error: "كلمة المرور الحالية غير صحيحة", fields: { current: "غير صحيحة" } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "تعذر تغيير كلمة المرور، حاول مرة أخرى" };
  return { fields: { ok: "1" } };
}
