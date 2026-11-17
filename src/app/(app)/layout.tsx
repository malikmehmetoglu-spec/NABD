import { BottomNav, Sidebar } from "@/components/nav";
import { Icon } from "@/components/icons";
import { READ_ONLY_MESSAGE, requireSession } from "@/lib/session";
import { ROLE } from "@/lib/labels";
import { daysUntil, formatDate } from "@/lib/time";
import { signOut } from "@/app/(auth)/actions";

const WARN_DAYS = 7;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { clinic, member, access } = await requireSession();

  if (access === "suspended") {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="max-w-md rounded-card border-[1.5px] border-line bg-white p-8 text-center shadow-card">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-soft text-orange-ink">
            <Icon name="alert" size={26} />
          </span>
          <h1 className="mt-4 text-xl font-extrabold">حساب العيادة معلّق</h1>
          <p className="mt-2 text-sm leading-7 text-muted">
            علّقت إدارة نبض حساب {clinic.name}. بياناتك محفوظة كما هي، وتعود فور إعادة التفعيل. تواصل مع نبض لمعرفة السبب.
          </p>
          <form action={signOut} className="mt-6">
            <button className="text-sm font-semibold text-brand hover:underline">تسجيل الخروج</button>
          </form>
        </div>
      </main>
    );
  }

  const daysLeft = daysUntil(clinic.expires_at);
  const banner =
    access === "expired"
      ? { tone: "border-danger-line bg-danger-soft text-danger-ink", text: READ_ONLY_MESSAGE }
      : daysLeft <= WARN_DAYS
        ? { tone: "border-orange/40 bg-orange-soft text-orange-ink", text: `ينتهي اشتراك العيادة في ${formatDate(clinic.expires_at, clinic.timezone)} (بعد ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}). تواصل مع نبض للتجديد.` }
        : null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar clinicName={clinic.name} userName={member.full_name} roleLabel={ROLE[member.role]} signOut={signOut} />
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-7 lg:pb-10">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 md:gap-6">
          {banner && (
            <div role="status" className={`no-print flex items-center gap-2.5 rounded-xl border-[1.5px] px-4 py-3 text-sm font-semibold ${banner.tone}`}>
              <Icon name="alert" size={18} />
              {banner.text}
            </div>
          )}
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
