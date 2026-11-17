import { notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { adminMetadata } from "../../metadata";
import { formatDate, isoDateIn } from "@/lib/time";
import { formatMoney, SPECIALTIES } from "@/lib/labels";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { PLATFORM_TIMEZONE } from "../../config";
import { STATE_LABEL, subscriptionState } from "../../status";
import { DeleteClinicForm, PaymentForm, SubscriptionForm } from "./forms";

export const generateMetadata = () => adminMetadata("تفاصيل العيادة");

export default async function AdminClinicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await getUser();
  const [{ data: clinic }, { data: plans }, { data: payments }] = await Promise.all([
    supabase.rpc("admin_clinics").eq("id", id).maybeSingle(),
    supabase.from("plans").select("*").order("sort"),
    supabase.from("subscription_payments").select("*").eq("clinic_id", id).order("paid_at", { ascending: false }),
  ]);
  if (!clinic) notFound();
  const state = STATE_LABEL[subscriptionState(clinic)];
  const tz = PLATFORM_TIMEZONE;

  const facts = [
    { label: "المالك", value: clinic.owner_name ?? "—" },
    { label: "البريد", value: clinic.owner_email ?? "—", ltr: true },
    { label: "الهاتف", value: clinic.phone ?? "—", ltr: true },
    { label: "الاختصاص", value: SPECIALTIES[clinic.specialty] ?? clinic.specialty },
    { label: "تاريخ التسجيل", value: formatDate(clinic.created_at, tz) },
    { label: "المرضى", value: `${clinic.patient_count}${clinic.max_patients ? ` من ${clinic.max_patients}` : " · بلا حد"}` },
    { label: "الطاقم", value: `${clinic.staff_count}${clinic.max_staff ? ` من ${clinic.max_staff}` : " · بلا حد"}` },
    { label: "آخر دفعة", value: clinic.last_payment_at ? formatDate(clinic.last_payment_at, tz) : "لا توجد" },
  ];

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{clinic.name} <Badge tone={state.tone}>{state.label}</Badge></span>}
        subtitle={`${clinic.plan_name} · ${subscriptionState(clinic) === "expired" ? "انتهى" : "ينتهي"} ${formatDate(clinic.expires_at, tz)}`}
        actions={<LinkButton href="/admin" variant="secondary">كل العيادات</LinkButton>}
      />

      <Card className="p-5 md:p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((x) => (
            <div key={x.label}>
              <dt className="text-xs text-muted">{x.label}</dt>
              <dd className="tabular mt-1 truncate font-semibold" dir={x.ltr ? "ltr" : undefined}>{x.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <section className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="p-5 md:p-6">
          <CardHeader title="تسجيل دفعة اشتراك" />
          <PaymentForm clinicId={clinic.id} plans={plans ?? []} plan={clinic.plan} />
        </Card>
        <Card className="p-5 md:p-6">
          <CardHeader title="تعديل الاشتراك يدوياً" />
          <SubscriptionForm
            key={`${clinic.plan}-${clinic.status}-${clinic.expires_at}-${clinic.max_staff_override}-${clinic.max_patients_override}`}
            clinicId={clinic.id}
            plans={plans ?? []}
            plan={clinic.plan}
            status={clinic.status}
            expiresOn={isoDateIn(clinic.expires_at, tz)}
            maxStaffOverride={clinic.max_staff_override}
            maxPatientsOverride={clinic.max_patients_override}
          />
        </Card>
      </section>

      <Card className="px-4 py-3 md:px-5">
        <CardHeader title="سجل مدفوعات الاشتراك" />
        {!payments?.length ? (
          <EmptyState icon="wallet" title="لا توجد مدفوعات مسجلة" />
        ) : (
          <ul>
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-divider py-3 first:border-t-0">
                <div className="min-w-40 flex-1">
                  <div className="text-sm font-semibold">{plans?.find((x) => x.code === p.plan)?.name ?? p.plan} · {p.months} {p.months === 1 ? "شهر" : "أشهر"}</div>
                  <div className="mt-0.5 text-xs text-muted">{formatDate(p.paid_at, tz)} · حتى {formatDate(p.period_end, tz)}{p.note ? ` · ${p.note}` : ""}</div>
                </div>
                <span className="tabular text-sm font-bold text-green">{formatMoney(Number(p.amount), p.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="border-danger-line p-5 md:p-6">
        <CardHeader title="منطقة الخطر" />
        <p className="mb-4 text-sm leading-7 text-muted">
          الحذف نهائي: يمسح العيادة ومرضاها ومواعيدها وزياراتها ووصفاتها ومدفوعاتها، ولا يمكن التراجع عنه. لإيقاف العيادة مؤقتاً استخدم الحالة «معلّقة» بدلاً منه.
        </p>
        <DeleteClinicForm clinicId={clinic.id} name={clinic.name} />
      </Card>
    </>
  );
}
