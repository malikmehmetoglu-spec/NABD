import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canWriteMedical, requireSession } from "@/lib/session";
import { Badge, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { VisitForm } from "./form";

export const metadata: Metadata = { title: "زيارة جديدة" };

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<{ patient?: string; appointment?: string }> }) {
  const sp = await searchParams;
  const { supabase, clinic, member } = await requireSession();
  if (!canWriteMedical(member.role)) redirect("/appointments");

  let patientId = sp.patient;
  let appointmentId: string | undefined;
  let reason: string | null = null;
  if (sp.appointment) {
    const { data: a } = await supabase.from("appointments").select("id, patient_id, reason, status").eq("id", sp.appointment).maybeSingle();
    if (!a) notFound();
    if (a.status === "completed") redirect(`/patients/${a.patient_id}`);
    patientId = a.patient_id;
    appointmentId = a.id;
    reason = a.reason;
  }
  if (!patientId) notFound();
  const { data: p } = await supabase.from("patients").select("id, full_name, allergies, file_number").eq("id", patientId).maybeSingle();
  if (!p) notFound();

  return (
    <>
      <PageHeader title="زيارة جديدة" subtitle={`${p.full_name} · رقم الإضبارة ${p.file_number}`} />
      {p.allergies.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl border-[1.5px] border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          <Icon name="alert" />
          <b>انتبه — حساسية:</b>
          {p.allergies.map((a) => <Badge key={a} tone="danger" className="bg-white">{a}</Badge>)}
        </div>
      )}
      <VisitForm patientId={p.id} appointmentId={appointmentId} complaint={reason} defaultFee={Number(clinic.default_fee)} allergies={p.allergies} />
    </>
  );
}
