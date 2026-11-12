"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { cx } from "./ui";

type Item = { href: string; label: string; icon: IconName };

export const NAV: Item[] = [
  { href: "/", label: "لوحة التحكم", icon: "dashboard" },
  { href: "/appointments", label: "المواعيد", icon: "calendar" },
  { href: "/patients", label: "المرضى", icon: "patients" },
  { href: "/payments", label: "المدفوعات", icon: "wallet" },
  { href: "/settings", label: "إعدادات العيادة", icon: "settings" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function Sidebar({ clinicName, userName, roleLabel, signOut }: { clinicName: string; userName: string; roleLabel: string; signOut: () => Promise<void> }) {
  const path = usePathname();
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-[252px] flex-none flex-col gap-6 bg-linear-to-b from-brand-deep via-[#0558a8] to-[#0b6ec7] px-3.5 py-5 lg:flex">
      <div className="flex items-center gap-3 px-2">
        <span className="grid size-10 place-items-center rounded-xl border border-white/25 bg-white/15">
          <Image src="/Logo_Nabd_icon.png" alt="" width={26} height={26} />
        </span>
        <div className="min-w-0">
          <div className="text-[21px] leading-none font-extrabold text-white">نبض</div>
          <div className="mt-1 truncate text-xs text-white/75">{clinicName}</div>
        </div>
      </div>

      <nav aria-label="القائمة الرئيسية" className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(path, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
                active ? "bg-white font-bold text-brand shadow-[0_6px_16px_rgba(4,40,80,.18)]" : "text-white/85 hover:bg-white/10 hover:text-white",
              )}
            >
              {active && <span className="absolute -start-3.5 top-2.5 h-6 w-1 rounded bg-indicator" />}
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/8 p-3">
        <span className="grid size-9.5 flex-none place-items-center rounded-full border border-white/30 bg-white/15 font-bold text-white">{[...userName][0]}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-white">{userName}</div>
          <div className="mt-0.5 text-xs text-white/75">{roleLabel}</div>
        </div>
        <form action={signOut}>
          <button aria-label="تسجيل الخروج" className="grid size-10 place-items-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white">
            <Icon name="logout" size={19} />
          </button>
        </form>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="التنقل السفلي"
      className="no-print fixed inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-[22px] bg-linear-to-br from-brand/95 via-[#0558a8]/95 to-[#04407c]/95 p-1.5 shadow-[0_10px_30px_rgba(4,64,124,.35)] backdrop-blur lg:hidden"
    >
      {NAV.map((item) => {
        const active = isActive(path, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex min-h-12 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10.5px] font-semibold",
              active ? "bg-white/18 text-white" : "text-white/80",
            )}
          >
            <Icon name={item.icon} size={21} />
            {item.label === "إعدادات العيادة" ? "الإعدادات" : item.label === "لوحة التحكم" ? "الرئيسية" : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
