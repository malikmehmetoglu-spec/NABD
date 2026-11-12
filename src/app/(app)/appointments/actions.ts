"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { NEXT_STATUS } from "@/lib/labels";
import { zonedToUtc } from "@/lib/time";
import { dbError, fieldErrors, optionalText, type FormState } from "@/lib/forms";
import type { AppointmentStatus } from "@/lib/supabase/types";

const schema = z.object({
  patient_id: z.uuid("اختر المريض"),
  doctor_id: z.uuid("اختر الطبيب"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "اختر التاريخ"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "اختر الوقت"),
  duration: z.coerce.number().int().min(5, "5 دقائق على الأقل").max(480),
  reason: optionalText(200),
});

export async function createAppointment(_: FormState, form: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { supabase, clinic } = await requireSession();
  const d = parsed.data;

  const start = zonedToUtc(d.date, d.time, clinic.timezone);
  if (start.getTime() < Date.now() - 5 * 60_000) return { fields: { time: "لا يمكن الحجز في وقت مضى" }, error: "تحقق من الوقت" };
  const end = new Date(start.getTime() + d.duration * 60_000);

  const { error } = await supabase.from("appointments").insert({
    clinic_id: clinic.id,
    patient_id: d.patient_id,
    doctor_id: d.doctor_id,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    reason: d.reason,
  });
  if (error) return { error: dbError(error) };
  revalidatePath("/appointments");
  revalidatePath("/");
  redirect(`/appointments?date=${d.date}`);
}

const statuses = ["scheduled", "arrived", "in_progress", "completed", "cancelled", "no_show"] as const;

export async function setStatus(form: FormData) {
  const id = z.uuid().parse(form.get("id"));
  const next = z.enum(statuses).parse(form.get("status"));
  const { supabase } = await requireSession();

  const { data: appt } = await supabase.from("appointments").select("status").eq("id", id).single();
  if (!appt || !NEXT_STATUS[appt.status as AppointmentStatus].includes(next)) return;

  await supabase.from("appointments").update({ status: next }).eq("id", id);
  revalidatePath("/appointments");
  revalidatePath("/");
}
