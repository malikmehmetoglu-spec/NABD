import type { Metadata } from "next";
import Link from "next/link";
import { canWriteMedical, requireSession } from "@/lib/session";
import { addDays, dayRange, formatDayLong, isValidDate, todayIn } from "@/lib/time";
import { NEXT_STATUS, STATUS_ACTION } from "@/lib/labels";
import { Card, EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { Icon } from "@/components/icons";
import { AppointmentRow } from "@/components/appointment-row";
import type { AppointmentStatus } from "@/lib/supabase/types";
import { setStatus } from "./actions";

export const metadata: Metadata = { title: "المواعيد" };

const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "waiting", label: "في الانتظار" },
  { key: "done", label: "المكتملة" },
] as const;

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ date?: string; filter?: string }> }) {
  const sp = await searchParams;
  const { supabase, clinic, member } = await requireSession();
  const tz = clinic.timezone;
  const today = todayIn(tz);
  const date = isValidDate(sp.date) ? sp.date : today;
  const filter = FILTERS.some((f) => f.key === sp.filter) ? sp.filter! : "all";
  const r = dayRange(date, tz);

  const [{ data }, { data: members }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, status, reason, doctor_id, patient:patients(id, full_name)")
      .gte("starts_at", r.start)
      .lt("starts_at", r.end)
      .order("starts_at"),
    supabase.from("clinic_members").select("user_id, full_name"),
  ]);
  const doctors = new Map((members ?? []).map((m) => [m.user_id, m.full_name]));
  const all = (data ?? []).filter((a) => a.patient);
  const counts = {
    all: all.length,
    waiting: all.filter((a) => a.status === "arrived" || a.status === "in_progress").length,
    done: all.filter((a) => a.status === "completed").length,
  };
  const list = all.filter((a) =>
    filter === "waiting" ? a.status === "arrived" || a.status === "in_progress" : filter === "done" ? a.status === "completed" : true,
  );
  const medical = canWriteMedical(member.role);
  const q = (o: Record<string, string>) => `/appointments?${new URLSearchParams({ date, filter, ...o })}`;

  return (
    <>
      <PageHeader title="المواعيد" subtitle={formatDayLong(date) + (date === today ? " · اليوم" : "")} actions={<LinkButton href={`/appointments/new?date=${date}`} icon="plus">موعد جديد</LinkButton>} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-2xl border-[1.5px] border-line bg-white p-1 shadow-card">
          <Link href={q({ date: addDays(date, -1) })} aria-label="اليوم السابق" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-chip"><Icon name="chevronStart" /></Link>
          <form className="flex">
            <input type="hidden" name="filter" value={filter} />
            <input type="date" name="date" defaultValue={date} aria-label="اختر اليوم" className="h-10 rounded-xl px-2 text-sm font-semibold outline-none" />
            <button className="rounded-xl px-3 text-sm font-semibold text-brand hover:bg-sky">عرض</button>
          </form>
          <Link href={q({ date: addDays(date, 1) })} aria-label="اليوم التالي" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-chip"><Icon name="chevronEnd" /></Link>
        </div>
        {date !== today && <LinkButton href={q({ date: today })} variant="soft">اليوم</LinkButton>}

        <div role="group" aria-label="تصفية" className="ms-auto flex gap-1 rounded-2xl border-[1.5px] border-line bg-white p-1 shadow-card">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={q({ filter: f.key })}
              aria-current={filter === f.key ? "true" : undefined}
              className={cx("rounded-xl px-3.5 py-2 text-[13px] font-semibold", filter === f.key ? "bg-sky text-brand" : "text-muted hover:bg-chip")}
            >
              {f.label} <span className="tabular">{counts[f.key]}</span>
            </Link>
          ))}
        </div>
      </div>

      <Card className="px-4 py-2 md:px-5">
        {list.length === 0 ? (
          <EmptyState icon="calendar" title="لا توجد مواعيد">
            <LinkButton href={`/appointments/new?date=${date}`} variant="soft" className="mt-2">حجز موعد</LinkButton>
          </EmptyState>
        ) : (
          list.map((a) => {
            const st = a.status as AppointmentStatus;
            const nexts = NEXT_STATUS[st].filter((s) => s !== "completed");
            return (
              <AppointmentRow
                key={a.id}
                tz={tz}
                a={{ ...a, patient: a.patient!, doctorName: doctors.size > 1 ? doctors.get(a.doctor_id) : undefined }}
                actions={
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {medical && (st === "in_progress" || st === "arrived") && (
                      <LinkButton href={`/visits/new?appointment=${a.id}`} className="min-h-9 px-3 text-xs">بدء الزيارة</LinkButton>
                    )}
                    {nexts.slice(0, 2).map((s) => (
                      <form key={s} action={setStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value={s} />
                        <button className={cx("min-h-9 rounded-lg px-2.5 text-xs font-semibold", s === "cancelled" ? "text-danger-ink hover:bg-danger-soft" : "bg-chip text-ink hover:bg-sky hover:text-brand")}>
                          {STATUS_ACTION[s]}
                        </button>
                      </form>
                    ))}
                  </div>
                }
              />
            );
          })
        )}
      </Card>
    </>
  );
}
