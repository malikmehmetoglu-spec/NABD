import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { addDays, dayRange, formatDate, formatDayLong, formatTime, isValidDate, monthStart, todayIn } from "@/lib/time";
import { formatMoney, PAYMENT_METHOD } from "@/lib/labels";
import { Card, CardHeader, EmptyState, PageHeader, cx } from "@/components/ui";
import { PaymentForm } from "@/components/payment-form";
import type { PaymentMethod } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "المدفوعات" };

const RANGES = [
  { key: "today", label: "اليوم" },
  { key: "week", label: "آخر 7 أيام" },
  { key: "month", label: "هذا الشهر" },
] as const;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ range?: string; date?: string }> }) {
  const sp = await searchParams;
  const { supabase, clinic } = await requireSession();
  const tz = clinic.timezone;
  const today = todayIn(tz);
  const range = RANGES.find((r) => r.key === sp.range)?.key ?? "today";
  const from = range === "today" ? (isValidDate(sp.date) ? sp.date : today) : range === "week" ? addDays(today, -6) : monthStart(today);
  const to = range === "today" ? from : today;
  const r = { start: dayRange(from, tz).start, end: dayRange(to, tz).end };

  const [{ data: payments }, { data: fees }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, note, patient:patients(id, full_name)")
      .gte("paid_at", r.start)
      .lt("paid_at", r.end)
      .order("paid_at", { ascending: false })
      .limit(500),
    supabase.from("visits").select("fee").gte("visited_at", r.start).lt("visited_at", r.end),
  ]);

  const list = payments ?? [];
  const total = list.reduce((s, p) => s + Number(p.amount), 0);
  const billed = (fees ?? []).reduce((s, v) => s + Number(v.fee), 0);
  const byMethod = list.reduce<Record<PaymentMethod, number>>((acc, p) => {
    acc[p.method] += Number(p.amount);
    return acc;
  }, { cash: 0, card: 0, transfer: 0 });
  const money = (n: number) => formatMoney(n, clinic.currency);

  return (
    <>
      <PageHeader title="المدفوعات" subtitle={range === "today" ? formatDayLong(from) : `${formatDate(from)} — ${formatDate(to)}`} />

      <div role="group" aria-label="الفترة" className="flex w-fit gap-1 rounded-2xl border-[1.5px] border-line bg-white p-1 shadow-card">
        {RANGES.map((x) => (
          <Link key={x.key} href={`/payments?range=${x.key}`} aria-current={range === x.key ? "true" : undefined}
            className={cx("rounded-xl px-3.5 py-2 text-[13px] font-semibold", range === x.key ? "bg-sky text-brand" : "text-muted hover:bg-chip")}>
            {x.label}
          </Link>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        {[
          { label: "المقبوض", value: money(total), cls: "text-green", bar: "from-green" },
          { label: "أجور الزيارات", value: money(billed), cls: "", bar: "from-brand" },
          { label: "نقداً", value: money(byMethod.cash), cls: "", bar: "from-orange" },
          { label: "بطاقة وتحويل", value: money(byMethod.card + byMethod.transfer), cls: "", bar: "from-purple" },
        ].map((s) => (
          <Card key={s.label} className="relative overflow-hidden p-4 md:p-5">
            <div className={`absolute inset-x-0 top-0 h-1 bg-linear-to-l to-transparent ${s.bar}`} />
            <div className="text-xs font-semibold text-muted md:text-[13px]">{s.label}</div>
            <div className={`tabular mt-2 text-lg font-extrabold md:text-2xl ${s.cls}`}>{s.value}</div>
          </Card>
        ))}
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="px-4 py-3 md:px-5">
          <CardHeader title="سجل المدفوعات" action={<span className="text-xs text-muted">{list.length} دفعة</span>} />
          {list.length === 0 ? (
            <EmptyState icon="wallet" title="لا توجد مدفوعات في هذه الفترة" />
          ) : (
            <ul>
              {list.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-t border-divider py-3 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    {p.patient ? (
                      <Link href={`/patients/${p.patient.id}`} className="block truncate text-sm font-semibold text-ink hover:text-brand">{p.patient.full_name}</Link>
                    ) : <span className="text-sm">—</span>}
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {range === "today" ? formatTime(p.paid_at, tz) : formatDate(p.paid_at, tz)} · {PAYMENT_METHOD[p.method]}{p.note ? ` · ${p.note}` : ""}
                    </div>
                  </div>
                  <span className="tabular text-sm font-bold text-green">{money(Number(p.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <CardHeader title="تسجيل دفعة" />
          <PaymentForm />
        </Card>
      </section>
    </>
  );
}
