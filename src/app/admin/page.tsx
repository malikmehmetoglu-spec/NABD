import Link from "next/link";
import { getUser } from "@/lib/session";
import { adminMetadata } from "./metadata";
import { daysUntil, formatDate } from "@/lib/time";
import { formatNumber, SPECIALTIES } from "@/lib/labels";
import { Badge, Card, EmptyState, Input, PageHeader, cx } from "@/components/ui";
import { STATE_LABEL, subscriptionState, type SubscriptionState } from "./status";
import { PLATFORM_TIMEZONE } from "./config";

export const generateMetadata = () => adminMetadata("العيادات");

const FILTERS: { key: "all" | SubscriptionState; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "فعّالة" },
  { key: "expiring", label: "تنتهي قريباً" },
  { key: "expired", label: "منتهية" },
  { key: "suspended", label: "معلّقة" },
];

export default async function AdminClinicsPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await getUser();
  const { data, error } = await supabase.rpc("admin_clinics");
  if (error) throw new Error("تعذر تحميل العيادات");

  const rows = (data ?? []).map((c) => ({ ...c, state: subscriptionState(c) }));
  const counts: Record<string, number> = Object.fromEntries(FILTERS.map((f) => [f.key, f.key === "all" ? rows.length : rows.filter((r) => r.state === f.key).length]));
  const filter = FILTERS.find((f) => f.key === sp.f)?.key ?? "all";
  const q = (sp.q ?? "").trim().toLowerCase();
  const list = rows
    .filter((r) => filter === "all" || r.state === filter)
    .filter((r) => !q || [r.name, r.owner_name, r.owner_email, r.phone].some((v) => v?.toLowerCase().includes(q)))
    // المنتهية والتي تنتهي قريباً أولاً، لأنها ما يحتاج متابعة
    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());

  const href = (f: string) => `/admin?${new URLSearchParams({ ...(f !== "all" && { f }), ...(q && { q }) })}`;

  return (
    <>
      <PageHeader title="العيادات" subtitle={`${formatNumber(rows.length)} عيادة على المنصة`} />

      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        {(["active", "expiring", "expired", "suspended"] as const).map((k) => (
          <Link key={k} href={href(k)}>
            <Card className="p-4 transition hover:border-brand md:p-5">
              <div className="text-xs font-semibold text-muted md:text-[13px]">{FILTERS.find((f) => f.key === k)!.label}</div>
              <div className="tabular mt-2 text-2xl font-extrabold">{formatNumber(counts[k] ?? 0)}</div>
            </Card>
          </Link>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="تصفية" className="flex flex-wrap gap-1 rounded-2xl border-[1.5px] border-line bg-white p-1 shadow-card">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href(f.key)} aria-current={filter === f.key ? "true" : undefined}
              className={cx("rounded-xl px-3.5 py-2 text-[13px] font-semibold", filter === f.key ? "bg-sky text-brand" : "text-muted hover:bg-chip")}>
              {f.label} <span className="tabular">({counts[f.key]})</span>
            </Link>
          ))}
        </div>
        <form className="min-w-56 flex-1" action="/admin">
          {filter !== "all" && <input type="hidden" name="f" value={filter} />}
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="بحث بالاسم أو البريد أو الهاتف" aria-label="بحث" />
        </form>
      </div>

      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState icon="search" title="لا توجد عيادات مطابقة" />
        ) : (
          <ul>
            {list.map((c) => {
              const s = STATE_LABEL[c.state];
              const days = daysUntil(c.expires_at);
              return (
                <li key={c.id} className="border-t border-divider first:border-t-0">
                  <Link href={`/admin/clinics/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-canvas md:px-5">
                    <div className="min-w-48 flex-1">
                      <div className="font-semibold text-ink">{c.name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted">
                        {c.owner_name ?? "بلا مالك"}{c.owner_email ? ` · ${c.owner_email}` : ""} · {SPECIALTIES[c.specialty] ?? c.specialty}
                      </div>
                    </div>
                    <Badge tone="brand">{c.plan_name}</Badge>
                    <div className="tabular w-36 text-xs text-muted">
                      {c.state === "expired" ? "انتهى" : "ينتهي"} {formatDate(c.expires_at, PLATFORM_TIMEZONE)}
                      {c.state === "expiring" && <span className="block font-semibold text-orange-ink">بعد {days} {days === 1 ? "يوم" : "أيام"}</span>}
                    </div>
                    <div className="tabular w-28 text-xs text-muted">
                      {c.patient_count}{c.max_patients ? `/${c.max_patients}` : ""} مريض · {c.staff_count}{c.max_staff ? `/${c.max_staff}` : ""} عضو
                    </div>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
