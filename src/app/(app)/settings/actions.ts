"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { CURRENCIES, SPECIALTIES, TIMEZONES } from "@/lib/labels";
import { dbError, fieldErrors, optionalText, type FormState } from "@/lib/forms";


const clinicSchema = z.object({
  name: z.string().trim().min(2, "اسم العيادة مطلوب").max(120),
  specialty: z.string().refine((v) => v in SPECIALTIES, "اختر الاختصاص"),
  currency: z.string().refine((v) => v in CURRENCIES, "اختر العملة"),
  timezone: z.enum(TIMEZONES),
  phone: optionalText(30),
  address: optionalText(200),
  default_fee: z.coerce.number().min(0, "لا يمكن أن يكون سالباً").max(1e10),
  slot_minutes: z.coerce.number().int().min(5).max(240),
});

export async function updateClinic(_: FormState, form: FormData): Promise<FormState> {
  const parsed = clinicSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { supabase, clinic, member } = await requireSession();
  if (member.role !== "owner") return { error: "تعديل إعدادات العيادة للمالك فقط" };
  const { error } = await supabase.from("clinics").update(parsed.data).eq("id", clinic.id);
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  return { fields: { ok: "1" } };
}

export async function updateMyName(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ full_name: z.string().trim().min(2, "الاسم مطلوب").max(120) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { supabase, clinic, userId } = await requireSession();
  const { error } = await supabase.from("clinic_members").update(parsed.data).eq("clinic_id", clinic.id).eq("user_id", userId);
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  return { fields: { ok: "1" } };
}

export async function createInvite(form: FormData) {
  const role = z.enum(["doctor", "secretary"]).parse(form.get("role"));
  const { supabase, clinic } = await requireSession();
  await supabase.rpc("create_invite", { p_clinic: clinic.id, p_role: role });
  revalidatePath("/settings");
}

export async function revokeInvite(form: FormData) {
  const code = z.string().max(20).parse(form.get("code"));
  const { supabase } = await requireSession();
  await supabase.from("clinic_invites").delete().eq("code", code);
  revalidatePath("/settings");
}

export async function removeMember(form: FormData) {
  const userId = z.uuid().parse(form.get("user_id"));
  const { supabase, clinic, member } = await requireSession();
  if (member.role !== "owner" || userId === member.user_id) return;
  await supabase.from("clinic_members").delete().eq("clinic_id", clinic.id).eq("user_id", userId);
  revalidatePath("/settings");
}

