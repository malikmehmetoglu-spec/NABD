"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteMedical, requireSession } from "@/lib/session";
import { dbError, fieldErrors, optionalNumber, optionalText, type FormState } from "@/lib/forms";

const item = z.object({
  drug: z.string().trim().min(1).max(200),
  dose: optionalText(100),
  frequency: optionalText(100),
  duration: optionalText(100),
  instructions: optionalText(300),
});

const schema = z.object({
  patient_id: z.uuid(),
  appointment_id: z.union([z.literal(""), z.uuid()]).optional(),
  complaint: optionalText(1000),
  diagnosis: optionalText(1000),
  notes: optionalText(4000),
  bp_systolic: optionalNumber(40, 300),
  bp_diastolic: optionalNumber(20, 200),
  pulse: optionalNumber(20, 250),
  temperature: optionalNumber(30, 45),
  weight_kg: optionalNumber(0.5, 400),
  fee: z.coerce.number("أدخل الأجر").min(0, "لا يمكن أن يكون سالباً").max(1e10),
  paid: optionalNumber(0, 1e10),
  method: z.enum(["cash", "card", "transfer"]).default("cash"),
  rx_notes: optionalText(1000),
});

export async function saveVisit(_: FormState, form: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { supabase, clinic, member } = await requireSession();
  if (!canWriteMedical(member.role)) return { error: "تسجيل الزيارات للأطباء فقط" };

  // بنود الوصفة تأتي كحقول متكررة: drug[], dose[], ...
  const col = (k: string) => form.getAll(k).map(String);
  const drugs = col("drug");
  const items = drugs
    .map((drug, i) => ({ drug, dose: col("dose")[i], frequency: col("frequency")[i], duration: col("duration")[i], instructions: col("instructions")[i] }))
    .filter((it) => it.drug.trim())
    .map((it) => item.safeParse(it));
  if (items.some((r) => !r.success)) return { error: "أحد بنود الوصفة طويل جداً" };

  const d = parsed.data;
  if (d.paid !== null && d.paid > 0 && d.paid > d.fee + 0.0001 && d.fee > 0) {
    return { error: "تحقق من الحقول", fields: { paid: "المدفوع أكبر من الأجر" } };
  }

  const { error } = await supabase.rpc("save_visit", {
    p: { ...d, clinic_id: clinic.id, appointment_id: d.appointment_id || null, items: items.map((r) => r.data) },
  });
  if (error) return { error: dbError(error) };

  revalidatePath(`/patients/${d.patient_id}`);
  revalidatePath("/appointments");
  revalidatePath("/");
  redirect(`/patients/${d.patient_id}`);
}
