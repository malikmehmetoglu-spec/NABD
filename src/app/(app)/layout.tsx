import { BottomNav, Sidebar } from "@/components/nav";
import { requireSession } from "@/lib/session";
import { ROLE } from "@/lib/labels";
import { signOut } from "@/app/(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { clinic, member } = await requireSession();
  return (
    <div className="flex min-h-dvh">
      <Sidebar clinicName={clinic.name} userName={member.full_name} roleLabel={ROLE[member.role]} signOut={signOut} />
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-7 lg:pb-10">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 md:gap-6">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
