import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ageFrom, formatDate, todayIn } from "@/lib/time";
import { SPECIALTIES } from "@/lib/labels";
import { LinkButton } from "@/components/ui";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "وصفة طبية" };

export default async function PrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, clinic } = await requireSession();
  const { data: rx } = await supabase
    .from("prescriptions")
    .select("*, items:prescription_items(*), patient:patients(id, full_name, birth_date, file_number)")
    .eq("id", id)
    .maybeSingle();
  if (!rx || !rx.patient) notFound();
  const { data: doctor } = await supabase.from("clinic_members").select("full_name").eq("user_id", rx.doctor_id).maybeSingle();
  const items = [...rx.items].sort((a, b) => a.position - b.position);
  const age = ageFrom(rx.patient.birth_date, todayIn(clinic.timezone));

  return (
    <>
      <div className="no-print flex gap-2">
        <PrintButton />
        <LinkButton href={`/patients/${rx.patient.id}`} variant="secondary">العودة للملف</LinkButton>
      </div>

      <article className="mx-auto w-full max-w-[720px] rounded-card border-[1.5px] border-line bg-white p-8 shadow-card print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-brand pb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-brand">{clinic.name}</h1>
            <p className="mt-1 text-sm text-muted">{doctor?.full_name} · {SPECIALTIES[clinic.specialty] ?? ""}</p>
            {(clinic.phone || clinic.address) && <p className="mt-1 text-xs text-muted">{[clinic.address, clinic.phone].filter(Boolean).join(" · ")}</p>}
          </div>
          <Image src="/Logo_Nabd_icon.png" alt="" width={48} height={48} />
        </header>

        <dl className="grid grid-cols-3 gap-4 py-5 text-sm">
          <div><dt className="text-xs text-muted">المريض</dt><dd className="mt-1 font-bold">{rx.patient.full_name}</dd></div>
          <div><dt className="text-xs text-muted">العمر</dt><dd className="mt-1 font-bold">{age !== null ? `${age} سنة` : "—"}</dd></div>
          <div><dt className="text-xs text-muted">التاريخ</dt><dd className="mt-1 font-bold">{formatDate(rx.created_at, clinic.timezone)}</dd></div>
        </dl>

        <div className="text-4xl font-extrabold text-brand" dir="ltr">℞</div>
        <ol className="mt-3 flex flex-col gap-4">
          {items.map((it, i) => (
            <li key={it.id} className="flex gap-3 border-b border-divider pb-4">
              <span className="tabular font-bold text-muted">{i + 1}.</span>
              <div>
                <div className="font-bold">{it.drug}</div>
                <div className="mt-1 text-sm text-body">{[it.dose, it.frequency, it.duration && `لمدة ${it.duration}`].filter(Boolean).join(" — ")}</div>
                {it.instructions && <div className="mt-1 text-sm text-muted">{it.instructions}</div>}
              </div>
            </li>
          ))}
        </ol>
        {rx.notes && <p className="mt-5 rounded-xl bg-canvas p-4 text-sm leading-7">{rx.notes}</p>}

        <footer className="mt-14 flex justify-end">
          <div className="w-48 border-t border-ink pt-2 text-center text-xs text-muted">توقيع الطبيب</div>
        </footer>
      </article>
    </>
  );
}
