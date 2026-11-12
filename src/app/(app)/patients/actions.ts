"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { BLOOD_TYPES } from "@/lib/labels";
import { dbError, fieldErrors, optionalText, tagList, type FormState } from "@/lib/forms";

const patientSchema = z.object({
  full_name: z.string().trim().min(2, "الاسم مطلوب").max(120),
  gender: z.enum(["male", "female"], "اختر الجنس"),
  birth_date: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= new Date().toISOString().slice(0, 10)), "تاريخ غير صحيح"),
  phone: optionalText(30),
  blood_type: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (BLOOD_TYPES as readonly string[]).includes(v), "زمرة غير معروفة"),
  allergies: tagList,
  chronic_conditions: tagList,
  notes: optionalText(2000),
});

export async function savePatient(_: FormState, form: FormData): Promise<FormState> {
  const parsed = patientSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { supabase, clinic } = await requireSession();
  const id = form.get("id");
  const then = form.get("then");

  let patientId: string;
  if (typeof id === "string" && id) {
    const { error } = await supabase.from("patients").update(parsed.data).eq("id", id);
    if (error) return { error: dbError(error) };
    patientId = id;
  } else {
    const { data, error } = await supabase
      .from("patients")
      .insert({ ...parsed.data, clinic_id: clinic.id })
      .select("id")
      .single();
    if (error || !data) return { error: dbError(error) };
    patientId = data.id;
  }
  revalidatePath("/patients");
  redirect(then === "appointment" ? `/appointments/new?patient=${patientId}` : `/patients/${patientId}`);
}

const paymentSchema = z.object({
  patient_id: z.uuid("اختر المريض"),
  amount: z.coerce.number("أدخل المبلغ").positive("المبلغ يجب أن يكون أكبر من صفر").max(1e10),
  method: z.enum(["cash", "card", "transfer"]),
  note: optionalText(300),
});

export async function recordPayment(_: FormState, form: FormData): Promise<FormState> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { supabase, clinic, userId } = await requireSession();
  const { error } = await supabase.from("payments").insert({ ...parsed.data, clinic_id: clinic.id, created_by: userId });
  if (error) return { error: dbError(error) };
  revalidatePath(`/patients/${parsed.data.patient_id}`);
  revalidatePath("/payments");
  revalidatePath("/");
  return { error: undefined, fields: { ok: "1" } };
}

/** بحث سريع للمربع المنسدل عند حجز موعد أو تسجيل دفعة */
export async function searchPatients(q: string) {
  const { supabase } = await requireSession();
  const term = q.trim().slice(0, 60);
  let query = supabase.from("patients").select("id, full_name, phone, file_number").order("full_name").limit(8);
  if (term) {
    const safe = term.replace(/[%_,()]/g, " ");
    query = /^\d+$/.test(term)
      ? query.or(`phone.ilike.%${safe}%,file_number.eq.${Number(term)}`)
      : query.ilike("full_name", `%${safe}%`);
  }
  const { data } = await query;
  return data ?? [];
}
