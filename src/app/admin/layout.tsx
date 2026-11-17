import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/session";
import { signOut } from "@/app/(auth)/actions";
import { Icon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  return (await isPlatformAdmin())
    ? { title: { template: "%s · إدارة نبض", default: "إدارة نبض" } }
    : { title: "الصفحة غير موجودة" };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // غير الأدمن لا يعرف أن الصفحة موجودة
  if (!(await isPlatformAdmin())) notFound();
  return (
    <div className="min-h-dvh">
      <header className="no-print bg-linear-to-l from-brand-deep to-brand text-white">
        <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-3 md:px-8">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl border border-white/25 bg-white/15">
              <Image src="/Logo_Nabd_icon.png" alt="" width={22} height={22} />
            </span>
            <span className="text-lg font-extrabold">إدارة نبض</span>
          </Link>
          <form action={signOut} className="ms-auto">
            <button aria-label="تسجيل الخروج" className="grid size-10 place-items-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white">
              <Icon name="logout" size={19} />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-6 md:gap-6 md:px-8">{children}</main>
    </div>
  );
}
