import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { ageFrom, formatDate, todayIn } from "@/lib/time";
import { GENDER } from "@/lib/labels";
import { Avatar, Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "المرضى" };
const PAGE = 30;

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = "", page = "1" } = await searchParams;
  const { supabase, clinic } = await requireSession();
  const pageNo = Math.max(1, Number.parseInt(page, 10) || 1);
  const term = q.trim().slice(0, 60);

  let query = supabase
    .from("patients")
    .select("id, full_name, gender, birth_date, phone, file_number, allergies, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((pageNo - 1) * PAGE, pageNo * PAGE - 1);
  if (term) {
    const safe = term.replace(/[%_,()]/g, " ");
    query = /^\d+$/.test(term)
      ? query.or(`phone.ilike.%${safe}%,file_number.eq.${Number(term)}`)
      : query.ilike("full_name", `%${safe}%`);
  }
  const { data: patients, count } = await query;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const today = todayIn(clinic.timezone);
  const link = (p: number) => `/patients?${new URLSearchParams({ ...(term && { q: term }), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="إدارة المرضى"
        subtitle={`${total} ${term ? "نتيجة" : "مريض مسجل"}`}
        actions={<LinkButton href="/patients/new" icon="userPlus">إضافة مريض</LinkButton>}
      />

      <form role="search" className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-line bg-white px-4 shadow-card">
        <Icon name="search" size={18} className="text-faint" />
        <input
          name="q"
          defaultValue={term}
          aria-label="بحث"
          placeholder="ابحث بالاسم أو رقم الهاتف أو رقم الإضبارة"
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
        {term && <Link href="/patients" className="text-[13px] font-semibold">مسح</Link>}
      </form>

      <Card className="overflow-hidden">
        {!patients?.length ? (
          <EmptyState icon="patients" title={term ? "لا نتائج مطابقة" : "لا يوجد مرضى بعد"}>
            {!term && <LinkButton href="/patients/new" variant="soft" className="mt-2">أضف أول مريض</LinkButton>}
          </EmptyState>
        ) : (
          <ul>
            {patients.map((p) => {
              const age = ageFrom(p.birth_date, today);
              return (
                <li key={p.id} className="border-t border-divider first:border-t-0">
                  <Link href={`/patients/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 text-ink hover:bg-canvas md:px-5">
                    <Avatar name={p.full_name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{p.full_name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted">
                        {[GENDER[p.gender], age !== null && `${age} سنة`, p.phone].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {p.allergies.length > 0 && <Badge tone="danger" className="hidden sm:inline-flex">حساسية</Badge>}
                    <span className="hidden text-xs text-muted md:block">أضيف {formatDate(p.created_at, clinic.timezone)}</span>
                    <Badge tone="brand" className="tabular">#{p.file_number}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {pages > 1 && (
        <nav aria-label="الصفحات" className="flex items-center justify-center gap-2 text-sm">
          {pageNo > 1 && <LinkButton variant="secondary" href={link(pageNo - 1)}>السابق</LinkButton>}
          <span className="px-3 text-muted">صفحة {pageNo} من {pages}</span>
          {pageNo < pages && <LinkButton variant="secondary" href={link(pageNo + 1)}>التالي</LinkButton>}
        </nav>
      )}
    </>
  );
}
