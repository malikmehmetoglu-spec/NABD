import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { addDays, dayRange, formatDayLong, hourIn, monthStart, todayIn, weekdayShort, isoDateIn } from "@/lib/time";
import { formatMoney, formatNumber } from "@/lib/labels";
import { Card, CardHeader, EmptyState, LinkButton, StatCard, Badge } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { AppointmentRow } from "@/components/appointment-row";

export const metadata: Metadata = { title: "لوحة التحكم" };

function greeting(hour: number) {
  return hour < 12 ? "صباح الخير" : "مساء الخير";
}

export default async function DashboardPage() {
  const { supabase, clinic, member } = await requireSession();
  const tz = clinic.timezone;
  const today = todayIn(tz);
  const todayR = dayRange(today, tz);
  const monthR = { start: dayRange(monthStart(today), tz).start, end: todayR.end };
  const weekStart = addDays(today, -6);
  const weekR = { start: dayRange(weekStart, tz).start, end: todayR.end };

  const [patients, newThisMonth, newToday, appts, week, monthVisits, todayPay, members] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", monthR.start),
    supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", todayR.start),
    supabase
      .from("appointments")
      .select("id, starts_at, status, reason, doctor_id, patient:patients(id, full_name)")
      .gte("starts_at", todayR.start)
      .lt("starts_at", todayR.end)
      .order("starts_at"),
    supabase.from("appointments").select("starts_at").gte("starts_at", weekR.start).lt("starts_at", weekR.end).not("status", "in", "(cancelled,no_show)"),
    supabase.from("visits").select("patient_id, patient:patients(full_name)").gte("visited_at", monthR.start),
    supabase.from("payments").select("amount").gte("paid_at", todayR.start).lt("paid_at", todayR.end),
    supabase.from("clinic_members").select("user_id, full_name"),
  ]);

  const doctors = new Map((members.data ?? []).map((m) => [m.user_id, m.full_name]));
  const todayList = (appts.data ?? []).filter((a) => a.patient);
  const active = todayList.filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  const done = active.filter((a) => a.status === "completed").length;
  const progress = active.length ? Math.round((done / active.length) * 100) : 0;
  const waiting = active.filter((a) => a.status === "arrived").length;
  const revenue = (todayPay.data ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const perDay = new Map(days.map((d) => [d, 0]));
  for (const a of week.data ?? []) {
    const d = isoDateIn(a.starts_at, tz);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const maxDay = Math.max(1, ...perDay.values());
  const weekTotal = [...perDay.values()].reduce((s, n) => s + n, 0);

  const visitCounts = new Map<string, { name: string; n: number }>();
  for (const v of monthVisits.data ?? []) {
    if (!v.patient) continue;
    const cur = visitCounts.get(v.patient_id) ?? { name: v.patient.full_name, n: 0 };
    cur.n++;
    visitCounts.set(v.patient_id, cur);
  }
  const top = [...visitCounts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3);
  const visitsThisMonth = monthVisits.data?.length ?? 0;
  const dayOfMonth = Number(today.slice(8, 10));

  const quick: { href: string; label: string; icon: IconName; bg: string }[] = [
    { href: "/patients/new", label: "إضافة مريض", icon: "plus", bg: "from-brand to-brand-light" },
    { href: "/appointments/new", label: "حجز موعد", icon: "calendar", bg: "from-[#d0701b] to-[#f0a35a]" },
    { href: "/appointments", label: "قائمة الانتظار", icon: "pulse", bg: "from-teal to-[#3fc1a5]" },
    { href: "/payments", label: "تسجيل دفعة", icon: "wallet", bg: "from-purple to-[#a45bb3]" },
  ];

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-60 flex-1">
          <h1 className="text-[22px] font-extrabold md:text-[26px]">
            {greeting(hourIn(tz))}، {member.full_name}
          </h1>
          <p className="mt-1.5 text-sm text-muted">إليك ملخص نشاط العيادة اليوم · {formatDayLong(today)}</p>
        </div>
        <LinkButton href="/appointments/new" icon="plus" className="hidden md:inline-flex">موعد جديد</LinkButton>
      </header>

      <section className="grid grid-cols-2 gap-2.5 md:gap-4 xl:grid-cols-4">
        <StatCard accent="brand" icon="patients" label="إجمالي المرضى" value={formatNumber(patients.count ?? 0)} sub={`+${newThisMonth.count ?? 0} هذا الشهر`} />
        <StatCard accent="orange" icon="calendar" label="مواعيد اليوم" value={active.length} sub={`${done} مكتمل · ${waiting} في الانتظار · ${progress}%`} />
        <StatCard accent="purple" icon="pulse" label="زيارات هذا الشهر" value={visitsThisMonth} sub={`متوسط يومي ${(visitsThisMonth / dayOfMonth).toFixed(1)}`} />
        <StatCard accent="green" icon="userPlus" label="مرضى جدد هذا الشهر" value={newThisMonth.count ?? 0} sub={`${newToday.count ?? 0} اليوم`} />
      </section>

      <section aria-label="إجراءات سريعة" className="grid grid-cols-4 gap-2 md:gap-3.5">
        {quick.map((q) => (
          <Link
            key={q.href + q.label}
            href={q.href}
            className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-line bg-white p-2 text-center text-[11.5px] font-semibold text-ink shadow-card hover:border-sky-line md:flex-row md:justify-start md:gap-3 md:px-4 md:text-start md:text-sm"
          >
            <span className={`grid size-10 flex-none place-items-center rounded-xl bg-linear-to-br text-white ${q.bg}`}>
              <Icon name={q.icon} size={18} strokeWidth={2.2} />
            </span>
            {q.label}
          </Link>
        ))}
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card className="p-4 md:p-5.5">
          <CardHeader title="مواعيد اليوم" action={<Link href="/appointments" className="text-[13px] font-semibold">عرض الكل</Link>} />
          {todayList.length === 0 ? (
            <EmptyState icon="calendar" title="لا توجد مواعيد اليوم">
              <LinkButton href="/appointments/new" variant="soft" className="mt-2">حجز موعد</LinkButton>
            </EmptyState>
          ) : (
            todayList.slice(0, 8).map((a) => (
              <AppointmentRow key={a.id} tz={tz} a={{ ...a, patient: a.patient!, doctorName: doctors.size > 1 ? doctors.get(a.doctor_id) : undefined }} />
            ))
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="p-5">
            <CardHeader title="المواعيد آخر 7 أيام" action={<span className="text-xs text-muted">الإجمالي {weekTotal}</span>} />
            <div className="mt-4 flex h-36 items-end gap-2.5" role="img" aria-label={`المواعيد خلال آخر 7 أيام، المجموع ${weekTotal}`}>
              {days.map((d) => {
                const n = perDay.get(d) ?? 0;
                const isToday = d === today;
                return (
                  <div key={d} className={`flex h-full flex-1 flex-col items-center justify-end gap-2 text-[11px] ${isToday ? "font-bold text-brand" : "text-muted"}`}>
                    <span className="font-semibold">{n}</span>
                    <span
                      className={`block w-full rounded-t-lg rounded-b-sm ${isToday ? "bg-linear-to-b from-brand-light to-brand shadow-brand" : "bg-sky-line"}`}
                      style={{ height: `${Math.max(4, (n / maxDay) * 85)}%` }}
                    />
                    {weekdayShort(d).replace("ال", "")}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader title="إيراد اليوم" action={<Link href="/payments" className="text-[13px] font-semibold">التفاصيل</Link>} />
            <div className="tabular text-[28px] font-extrabold text-green">{formatMoney(revenue, clinic.currency)}</div>
            <p className="mt-1 text-xs text-muted">{todayPay.data?.length ?? 0} دفعة مسجلة اليوم</p>
          </Card>

          <Card className="p-5">
            <CardHeader title="أكثر المرضى زيارةً هذا الشهر" />
            {top.length === 0 ? (
              <p className="py-4 text-sm text-muted">لا توجد زيارات بعد هذا الشهر.</p>
            ) : (
              top.map(([id, p], i) => (
                <Link key={id} href={`/patients/${id}`} className="flex items-center gap-3 border-t border-divider py-2.5 text-ink first:border-t-0 hover:text-brand">
                  <span className="w-6 font-extrabold text-brand">{i + 1}</span>
                  <span className="flex-1 text-sm font-semibold">{p.name}</span>
                  <Badge tone="brand">{p.n} {p.n === 1 ? "زيارة" : p.n === 2 ? "زيارتان" : "زيارات"}</Badge>
                </Link>
              ))
            )}
          </Card>
        </div>
      </section>
    </>
  );
}
