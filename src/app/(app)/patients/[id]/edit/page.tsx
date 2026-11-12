import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { PatientForm } from "../../patient-form";

export const metadata: Metadata = { title: "تعديل بيانات المريض" };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireSession();
  const { data: patient } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (!patient) notFound();
  return (
    <>
      <PageHeader title="تعديل بيانات المريض" subtitle={patient.full_name} />
      <PatientForm patient={patient} />
    </>
  );
}
