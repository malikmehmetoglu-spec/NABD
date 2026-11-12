"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/session";
import { CURRENCIES, SPECIALTIES } from "@/lib/labels";
import { dbError, fieldErrors, optionalText, type FormState } from "@/lib/forms";

const schema = z.object({
  clinic_name: z.string().trim().min(2, "اسم العيادة مطلوب").max(120),
  owner_name: z.string().trim().min(2, "اسمك مطلوب").max(120),
  specialty: z.string().refine((v) => v in SPECIALTIES, "اختر الاختصاص"),
  currency: z.string().refine((v) => v in CURRENCIES, "اختر العملة"),
  phone: optionalText(30),
});

export async function createClinic(_: FormState, form: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const d = parsed.data;
  const { error } = await supabase.rpc("create_clinic", {
    p_name: d.clinic_name,
    p_specialty: d.specialty,
    p_currency: d.currency,
    p_owner_name: d.owner_name,
    p_phone: d.phone,
  });
  if (error && error.code !== "23505") return { error: dbError(error) };
  redirect("/");
}

const joinSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{10}$/, "الرمز 10 أحرف وأرقام"),
  full_name: z.string().trim().min(2, "اسمك مطلوب").max(120),
});

export async function joinClinic(_: FormState, form: FormData): Promise<FormState> {
  const parsed = joinSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("join_clinic", { p_code: parsed.data.code, p_full_name: parsed.data.full_name });
  if (error) {
    if (error.code === "P0002") return { error: "الرمز غير صحيح أو منتهي الصلاحية", fields: { code: "تحقق من الرمز" } };
    if (error.code !== "23505") return { error: dbError(error) };
  }
  redirect("/");
}
