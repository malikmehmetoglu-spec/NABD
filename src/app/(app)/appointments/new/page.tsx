import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { isValidDate, todayIn } from "@/lib/time";
import { PageHeader } from "@/components/ui";
import { AppointmentForm } from "./form";

export const metadata: Metadata = { title: "موعد جديد" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ date?: string; patient?: string }> }) {
  const sp = await searchParams;
  const { supabase, clinic, member } = await requireSession();
  const [{ data: members }, { data: patient }] = await Promise.all([
    supabase.from("clinic_members").select("user_id, full_name, role").in("role", ["owner", "doctor"]).order("full_name"),
    sp.patient
      ? supabase.from("patients").select("id, full_name, phone, file_number").eq("id", sp.patient).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const date = isValidDate(sp.date) ? sp.date : todayIn(clinic.timezone);
  const doctors = members ?? [];
  const defaultDoctor = doctors.find((d) => d.user_id === member.user_id)?.user_id ?? doctors[0]?.user_id;

  return (
    <>
      <PageHeader title="حجز موعد" subtitle="يمنع النظام تلقائياً حجز موعدين لنفس الطبيب في نفس الوقت" />
      <AppointmentForm doctors={doctors} defaultDoctor={defaultDoctor} date={date} slot={clinic.slot_minutes} patient={patient} />
    </>
  );
}
