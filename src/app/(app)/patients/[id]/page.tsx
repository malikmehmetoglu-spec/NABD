import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canWriteMedical, requireSession } from "@/lib/session";
import { ageFrom, formatDate, formatTime, todayIn } from "@/lib/time";
import { formatMoney, GENDER, PAYMENT_METHOD } from "@/lib/labels";
import { Badge, Card, CardHeader, LinkButton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PaymentForm } from "@/components/payment-form";
import type { Visit } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "ملف المريض" };

function Vital({ label, value, unit, warn }: { label: string; value: string | null; unit?: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border-[1.5px] p-3.5 md:p-4 ${warn ? "border-danger-line bg-danger-soft" : "border-divider bg-canvas"}`}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className={`tabular mt-1.5 text-xl font-extrabold md:text-2xl ${warn ? "text-danger-ink" : ""}`}>
        {value ?? "—"} {value && unit && <span className="text-xs font-medium text-muted">{unit}</span>}
      </div>
    </div>
  );
}

const highBp = (v: Visit) => (v.bp_systolic ?? 0) >= 140 || (v.bp_diastolic ?? 0) >= 90;

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, clinic, member } = await requireSession();
  const tz = clinic.timezone;

  const { data: p } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const nowIso = new Date().toISOString();
  const [visits, rxs, payments, balance, upcoming, members] = await Promise.all([
    supabase.from("visits").select("*").eq("patient_id", id).order("visited_at", { ascending: false }).limit(20),
    supabase.from("prescriptions").select("id, created_at, items:prescription_items(drug, dose, frequency, duration, position)").eq("patient_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("payments").select("*").eq("patient_id", id).order("paid_at", { ascending: false }).limit(10),
    supabase.from("patient_balances").select("*").eq("patient_id", id).maybeSingle(),
    supabase.from("appointments").select("id, starts_at, reason").eq("patient_id", id).gte("starts_at", nowIso).in("status", ["scheduled", "arrived"]).order("starts_at").limit(1).maybeSingle(),
    supabase.from("clinic_members").select("user_id, full_name"),
  ]);

  const doctors = new Map((members.data ?? []).map((m) => [m.user_id, m.full_name]));
  const age = ageFrom(p.birth_date, todayIn(tz));
  const last = visits.data?.[0];
  const fees = Number(balance.data?.total_fees ?? 0);
  const paid = Number(balance.data?.total_paid ?? 0);
  const due = fees - paid;
  const latestRx = rxs.data?.[0];
  const medical = canWriteMedical(member.role);

  return (
    <>
      <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-[13px] text-muted">
        <Link href="/patients" className="font-semibold">إدارة المرضى</Link>
        <span aria-hidden="true">‹</span>
        <span>{p.full_name}</span>
      </nav>

      <header className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-3xl bg-linear-to-br from-brand-dark via-brand to-brand-light p-5 text-white shadow-hero md:gap-5 md:p-7">
        <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute -end-10 -top-8 w-72 opacity-10">
          <circle cx="100" cy="100" r="80" fill="none" stroke="#fff" strokeWidth="22" />
        </svg>
        <span className="grid size-16 flex-none place-items-center rounded-[20px] border-[1.5px] border-white/35 bg-white/15 text-3xl font-extrabold md:size-19">
          {[...p.full_name][0]}
        </span>
        <div className="relative min-w-56 flex-1">
          <h1 className="text-2xl font-extrabold md:text-[28px]">{p.full_name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {[`${GENDER[p.gender]}${age !== null ? ` · ${age} سنة` : ""}`, `رقم الإضبارة ${p.file_number}`, p.phone, p.blood_type && `زمرة الدم ${p.blood_type}`]
              .filter(Boolean)
              .map((t) => (
                <span key={t as string} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">{t}</span>
              ))}
          </div>
        </div>
        <div className="relative flex w-full flex-wrap gap-2 md:w-auto">
          <Link href={`/patients/${p.id}/edit`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/30 bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25 md:flex-none">تعديل</Link>
          {p.phone && (
            <a href={`tel:${p.phone}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25 md:flex-none">
              <Icon name="phone" size={17} />اتصال
            </a>
          )}
          <Link href={`/appointments/new?patient=${p.id}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/30 bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25 md:flex-none">موعد</Link>
          {medical && (
            <Link href={`/visits/new?patient=${p.id}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-brand shadow-[0_6px_16px_rgba(4,40,80,.2)] md:flex-none">
              زيارة جديدة
            </Link>
          )}
        </div>
      </header>

      {p.allergies.length > 0 && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border-[1.5px] border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          <Icon name="alert" />
          <span><b className="font-bold">الحساسية:</b> {p.allergies.join("، ")}</span>
        </div>
      )}

      <section className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="p-5">
            <CardHeader title="العلامات الحيوية" action={last && <span className="text-xs text-muted">آخر قياس: {formatDate(last.visited_at, tz)}</span>} />
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
              <Vital label="الضغط" value={last?.bp_systolic ? `${last.bp_systolic}/${last.bp_diastolic ?? "—"}` : null} warn={!!last && highBp(last)} />
              <Vital label="النبض" value={last?.pulse ? String(last.pulse) : null} unit="ن/د" />
              <Vital label="الوزن" value={last?.weight_kg ? String(last.weight_kg) : null} unit="كغ" />
              <Vital label="الحرارة" value={last?.temperature ? String(last.temperature) : null} unit="°م" />
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader title="سجل الزيارات" action={<span className="text-xs text-muted">{visits.data?.length ?? 0} زيارة</span>} />
            {!visits.data?.length ? (
              <p className="py-4 text-sm text-muted">لم تُسجل زيارات بعد.</p>
            ) : (
              <ol className="mt-1">
                {visits.data.map((v, i) => (
                  <li key={v.id} className="grid grid-cols-[84px_18px_1fr] gap-3 md:grid-cols-[110px_18px_1fr]">
                    <div className="pt-0.5 text-[13px] text-muted">{formatDate(v.visited_at, tz)}</div>
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 size-3 rounded-full ${i === 0 ? "bg-brand ring-4 ring-sky" : "border-[2.5px] border-brand bg-white"}`} />
                      {i < visits.data.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
                    </div>
                    <div className="pb-5">
                      <div className="font-bold">{v.diagnosis || v.complaint || "زيارة"}</div>
                      {(v.complaint && v.diagnosis) && <p className="mt-1 text-sm text-body">الشكوى: {v.complaint}</p>}
                      {v.notes && <p className="mt-1 text-sm leading-7 whitespace-pre-line text-body">{v.notes}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {doctors.get(v.doctor_id) && <Badge>{doctors.get(v.doctor_id)}</Badge>}
                        {Number(v.fee) > 0 && <Badge tone="green">{formatMoney(Number(v.fee), clinic.currency)}</Badge>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="p-5">
            <CardHeader title="آخر وصفة" action={latestRx && <Link href={`/prescriptions/${latestRx.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold"><Icon name="print" size={16} />طباعة</Link>} />
            {!latestRx ? (
              <p className="text-sm text-muted">لا توجد وصفات.</p>
            ) : (
              <>
                <p className="mb-1 text-xs text-muted">{formatDate(latestRx.created_at, tz)}</p>
                {[...latestRx.items].sort((a, b) => a.position - b.position).map((it, i) => (
                  <div key={i} className="flex items-center gap-3 border-t border-divider py-2.5 first:border-t-0">
                    <span className="grid size-9 flex-none place-items-center rounded-[11px] bg-purple-soft text-purple"><Icon name="pill" size={18} /></span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{it.drug}</div>
                      <div className="mt-0.5 text-xs text-muted">{[it.dose, it.frequency, it.duration].filter(Boolean).join(" · ")}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </Card>

          {p.chronic_conditions.length > 0 && (
            <Card className="p-5">
              <CardHeader title="الأمراض المزمنة" />
              <div className="flex flex-wrap gap-2">
                {p.chronic_conditions.map((c) => <Badge key={c} tone="brand" className="px-3 py-1.5 text-[13px]">{c}</Badge>)}
              </div>
            </Card>
          )}

          <Card className="relative overflow-hidden p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-l from-green to-transparent" />
            <CardHeader title="المدفوعات" />
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-muted">المدفوع</div>
                <div className="tabular mt-1 text-xl font-extrabold text-green">{formatMoney(paid, clinic.currency)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted">المتبقي</div>
                <div className={`tabular mt-1 text-xl font-extrabold ${due > 0 ? "text-danger" : "text-ink"}`}>{formatMoney(Math.max(0, due), clinic.currency)}</div>
              </div>
            </div>
            <PaymentForm patientId={p.id} suggested={due} />
            {!!payments.data?.length && (
              <ul className="mt-4">
                {payments.data.map((x) => (
                  <li key={x.id} className="flex justify-between border-t border-divider py-2 text-sm">
                    <span className="text-muted">{formatDate(x.paid_at, tz)} · {PAYMENT_METHOD[x.method]}</span>
                    <span className="tabular font-semibold">{formatMoney(Number(x.amount), clinic.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <CardHeader title="الموعد القادم" />
            {upcoming.data ? (
              <div className="text-sm">
                <div className="font-semibold">{formatDate(upcoming.data.starts_at, tz)} · {formatTime(upcoming.data.starts_at, tz)}</div>
                {upcoming.data.reason && <div className="mt-1 text-xs text-muted">{upcoming.data.reason}</div>}
              </div>
            ) : (
              <LinkButton href={`/appointments/new?patient=${p.id}`} variant="soft" className="w-full">حجز موعد</LinkButton>
            )}
          </Card>

          {p.notes && (
            <Card className="p-5">
              <CardHeader title="ملاحظات" />
              <p className="text-sm leading-7 whitespace-pre-line text-body">{p.notes}</p>
            </Card>
          )}
        </div>
      </section>
    </>
  );
}
