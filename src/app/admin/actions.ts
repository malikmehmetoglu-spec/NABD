"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser, isPlatformAdmin } from "@/lib/session";
import { authAdmin, MISSING_SECRET } from "@/lib/supabase/service";
import { generatePassword } from "@/lib/password";
import { zonedToUtc } from "@/lib/time";
import { CURRENCIES, SPECIALTIES } from "@/lib/labels";
import { dbError, fieldErrors, optionalText, type FormState } from "@/lib/forms";
import { PLATFORM_TIMEZONE } from "./config";

/** قاعدة البيانات تتحقق من الأدمن في كل دالة؛ هذا الفحص يسبق أي استخدام للمفتاح السري */
async function adminClient() {
  if (!(await isPlatformAdmin())) return null;
  return (await getUser()).supabase;
}

const NOT_ADMIN = { error: "للأدمن فقط" };
const endOfDay = (date: string) => zonedToUtc(date, "23:59", PLATFORM_TIMEZONE).toISOString();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "اختر التاريخ");

/** ينشئ حساب دخول مؤكداً بكلمة مرور عشوائية */
async function createLogin(email: string): Promise<{ id: string; password: string } | { error: FormState }> {
  const auth = authAdmin();
  if (!auth) return { error: { error: MISSING_SECRET } };
  const password = generatePassword();
  const { data, error } = await auth.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    const exists = error?.code === "email_exists" || /already/i.test(error?.message ?? "");
    return { error: exists ? { error: "هذا البريد مستخدم لحساب آخر", fields: { email: "مستخدم مسبقاً" } } : { error: "تعذر إنشاء حساب الدخول" } };
  }
  return { id: data.user.id, password };
}

// ── عيادة جديدة مع حساب مالكها ─────────────────────────────
const clinicSchema = z.object({
  clinic_name: z.string().trim().min(2, "اسم العيادة مطلوب").max(120),
  owner_name: z.string().trim().min(2, "اسم المالك مطلوب").max(120),
  email: z.email("بريد غير صحيح").trim().toLowerCase(),
  phone: optionalText(30),
  specialty: z.string().refine((v) => v in SPECIALTIES, "اختر الاختصاص"),
  currency: z.string().refine((v) => v in CURRENCIES, "اختر العملة"),
  plan: z.string().min(1, "اختر الخطة"),
  expires_on: date,
});

export async function createClinicAccount(_: FormState, form: FormData): Promise<FormState> {
  const parsed = clinicSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;
  const d = parsed.data;

  const login = await createLogin(d.email);
  if ("error" in login) return login.error;

  const { data: clinicId, error } = await supabase.rpc("admin_create_clinic", {
    p_owner: login.id,
    p_name: d.clinic_name,
    p_owner_name: d.owner_name,
    p_specialty: d.specialty,
    p_currency: d.currency,
    p_phone: d.phone,
    p_plan: d.plan,
    p_expires_at: endOfDay(d.expires_on),
  });
  if (error || !clinicId) {
    await authAdmin()?.deleteUser(login.id); // لا نترك حساباً بلا عيادة
    return { error: dbError(error) };
  }
  revalidatePath("/admin", "layout");
  return { fields: { ok: "1", clinic_id: clinicId, email: d.email, password: login.password, name: d.owner_name } };
}

// ── طاقم العيادة ────────────────────────────────────────────
const memberSchema = z.object({
  clinic_id: z.uuid(),
  full_name: z.string().trim().min(2, "الاسم مطلوب").max(120),
  email: z.email("بريد غير صحيح").trim().toLowerCase(),
  role: z.enum(["doctor", "secretary"]),
});

export async function addMember(_: FormState, form: FormData): Promise<FormState> {
  const parsed = memberSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;
  const d = parsed.data;

  const login = await createLogin(d.email);
  if ("error" in login) return login.error;

  const { error } = await supabase.rpc("admin_add_member", { p_clinic: d.clinic_id, p_user: login.id, p_role: d.role, p_full_name: d.full_name });
  if (error) {
    await authAdmin()?.deleteUser(login.id);
    return { error: dbError(error) };
  }
  revalidatePath(`/admin/clinics/${d.clinic_id}`);
  return { fields: { ok: "1", email: d.email, password: login.password, name: d.full_name } };
}

/** يتأكد أن الحساب عضو في هذه العيادة قبل لمسه بالمفتاح السري */
async function memberOf(supabase: NonNullable<Awaited<ReturnType<typeof adminClient>>>, clinicId: string, userId: string) {
  const { data } = await supabase.rpc("admin_clinic_members", { p_clinic: clinicId });
  return (data ?? []).find((m) => m.user_id === userId) ?? null;
}

const memberRef = z.object({ clinic_id: z.uuid(), user_id: z.uuid() });

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = memberRef.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "طلب غير صالح" };
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;
  const m = await memberOf(supabase, parsed.data.clinic_id, parsed.data.user_id);
  if (!m) return { error: "الحساب ليس عضواً في هذه العيادة" };

  const auth = authAdmin();
  if (!auth) return { error: MISSING_SECRET };
  const password = generatePassword();
  const { error } = await auth.updateUserById(m.user_id, { password });
  if (error) return { error: "تعذر تغيير كلمة المرور" };
  return { fields: { ok: "1", email: m.email ?? "", password, name: m.full_name } };
}

export async function removeMember(_: FormState, form: FormData): Promise<FormState> {
  const parsed = memberRef.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "طلب غير صالح" };
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;
  const auth = authAdmin();
  if (!auth) return { error: MISSING_SECRET };
  const { error } = await supabase.rpc("admin_remove_member", { p_clinic: parsed.data.clinic_id, p_user: parsed.data.user_id });
  if (error) return { error: dbError(error) };
  await auth.deleteUser(parsed.data.user_id);
  revalidatePath(`/admin/clinics/${parsed.data.clinic_id}`);
  return { fields: { ok: "1" } };
}

// ── الاشتراك ────────────────────────────────────────────────
const optionalLimit = z
  .union([z.literal(""), z.coerce.number().int("رقم صحيح").min(1, "1 على الأقل").max(100000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const subscriptionSchema = z.object({
  clinic_id: z.uuid(),
  plan: z.string().min(1, "اختر الخطة"),
  status: z.enum(["active", "suspended"]),
  expires_on: date,
  max_staff_override: optionalLimit,
  max_patients_override: optionalLimit,
});

export async function updateSubscription(_: FormState, form: FormData): Promise<FormState> {
  const parsed = subscriptionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;
  const d = parsed.data;
  const { error } = await supabase.rpc("admin_update_subscription", {
    p_clinic: d.clinic_id,
    p_plan: d.plan,
    p_status: d.status,
    p_expires_at: endOfDay(d.expires_on),
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
  if (!supabase) return NOT_ADMIN;
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

// ── حذف العيادة مع حسابات أعضائها ───────────────────────────
const deleteSchema = z.object({ clinic_id: z.uuid(), confirm_name: z.string().trim().min(1, "اكتب اسم العيادة") });

export async function deleteClinic(_: FormState, form: FormData): Promise<FormState> {
  const parsed = deleteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;
  const auth = authAdmin();
  if (!auth) return { error: MISSING_SECRET };
  const { data: members } = await supabase.rpc("admin_clinic_members", { p_clinic: parsed.data.clinic_id });
  const { error } = await supabase.rpc("admin_delete_clinic", {
    p_clinic: parsed.data.clinic_id,
    p_confirm_name: parsed.data.confirm_name,
  });
  if (error) {
    return error.code === "P0002"
      ? { error: "الاسم لا يطابق اسم العيادة", fields: { confirm_name: "اكتب الاسم كما هو تماماً" } }
      : { error: dbError(error) };
  }
  // حسابات الدخول لم تعد مرتبطة بشيء
  await Promise.all((members ?? []).map((m) => auth.deleteUser(m.user_id)));
  revalidatePath("/admin", "layout");
  redirect("/admin");
}
