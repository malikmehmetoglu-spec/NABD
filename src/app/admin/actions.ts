"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser, isPlatformAdmin } from "@/lib/session";
import { zonedToUtc } from "@/lib/time";
import { dbError, fieldErrors, optionalText, type FormState } from "@/lib/forms";
import { PLATFORM_TIMEZONE } from "./config";

/** قاعدة البيانات تتحقق من الأدمن في كل دالة؛ هذا الفحص لرسالة واضحة فقط */
async function adminClient() {
  if (!(await isPlatformAdmin())) return null;
  return (await getUser()).supabase;
}

const optionalLimit = z
  .union([z.literal(""), z.coerce.number().int("رقم صحيح").min(1, "1 على الأقل").max(100000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const subscriptionSchema = z.object({
  clinic_id: z.uuid(),
  plan: z.string().min(1, "اختر الخطة"),
  status: z.enum(["active", "suspended"]),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "اختر التاريخ"),
  max_staff_override: optionalLimit,
  max_patients_override: optionalLimit,
});

export async function updateSubscription(_: FormState, form: FormData): Promise<FormState> {
  const parsed = subscriptionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return { error: "للأدمن فقط" };
  const d = parsed.data;
  // ينتهي الاشتراك في آخر دقيقة من اليوم المختار
  const expires = zonedToUtc(d.expires_on, "23:59", PLATFORM_TIMEZONE);
  const { error } = await supabase.rpc("admin_update_subscription", {
    p_clinic: d.clinic_id,
    p_plan: d.plan,
    p_status: d.status,
    p_expires_at: expires.toISOString(),
    p_max_staff_override: d.max_staff_override,
    p_max_patients_override: d.max_patients_override,
  });
  if (error) return { error: dbError(error) };
  revalidatePath("/admin", "layout");
  return { fields: { ok: "1" } };
}

const paymentSchema = z.object({
  clinic_id: z.uuid(),
  plan: z.string().min(1, "اختر الخطة"),
  months: z.coerce.number().int().min(1, "شهر على الأقل").max(36, "36 شهراً كحد أقصى"),
  amount: z.coerce.number("أدخل المبلغ").min(0, "لا يمكن أن يكون سالباً").max(1e7),
  currency: z.string().regex(/^[A-Z]{3}$/),
  note: optionalText(300),
});

export async function recordSubscriptionPayment(_: FormState, form: FormData): Promise<FormState> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return { error: "للأدمن فقط" };
  const d = parsed.data;
  const { error } = await supabase.rpc("admin_record_payment", {
    p_clinic: d.clinic_id,
    p_plan: d.plan,
    p_months: d.months,
    p_amount: d.amount,
    p_currency: d.currency,
    p_note: d.note,
  });
  if (error) return { error: dbError(error) };
  revalidatePath("/admin", "layout");
  return { fields: { ok: "1" } };
}

const deleteSchema = z.object({ clinic_id: z.uuid(), confirm_name: z.string().trim().min(1, "اكتب اسم العيادة") });

export async function deleteClinic(_: FormState, form: FormData): Promise<FormState> {
  const parsed = deleteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return { error: "للأدمن فقط" };
  const { error } = await supabase.rpc("admin_delete_clinic", {
    p_clinic: parsed.data.clinic_id,
    p_confirm_name: parsed.data.confirm_name,
  });
  if (error) {
    return error.code === "P0002"
      ? { error: "الاسم لا يطابق اسم العيادة", fields: { confirm_name: "اكتب الاسم كما هو تماماً" } }
      : { error: dbError(error) };
  }
  revalidatePath("/admin", "layout");
  redirect("/admin");
}
