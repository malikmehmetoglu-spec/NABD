import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { PatientForm } from "../patient-form";

export const metadata: Metadata = { title: "مريض جديد" };

export default async function NewPatientPage({ searchParams }: { searchParams: Promise<{ then?: string }> }) {
  const { then } = await searchParams;
  return (
    <>
      <PageHeader title="إضافة مريض جديد" subtitle="يُعطى المريض رقم إضبارة تلقائياً" />
      <PatientForm then={then === "appointment" ? "appointment" : undefined} />
    </>
  );
}
