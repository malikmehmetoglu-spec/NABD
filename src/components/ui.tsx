import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import type { Tone } from "@/lib/labels";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ── البطاقة ─────────────────────────────────────────────────
export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-card border-[1.5px] border-line bg-white shadow-card", className)} {...p} />;
}

export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold">{title}</h2>
      {action}
    </div>
  );
}

// ── الأزرار ─────────────────────────────────────────────────
const buttonStyles = {
  primary: "bg-linear-to-l from-brand-light to-brand text-white shadow-brand hover:brightness-105",
  secondary: "border-[1.5px] border-line bg-white text-ink hover:bg-canvas",
  soft: "bg-sky text-brand hover:bg-sky-line",
  danger: "bg-danger-soft text-danger-ink hover:bg-danger-line/60",
  ghost: "text-muted hover:bg-chip hover:text-ink",
} as const;
type Variant = keyof typeof buttonStyles;

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export function Button({ variant = "primary", icon, className, children, ...p }: ComponentProps<"button"> & { variant?: Variant; icon?: IconName }) {
  return (
    <button className={cx(base, buttonStyles[variant], className)} {...p}>
      {icon && <Icon name={icon} size={18} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", icon, className, children, ...p }: ComponentProps<typeof Link> & { variant?: Variant; icon?: IconName }) {
  return (
    <Link className={cx(base, buttonStyles[variant], className)} {...p}>
      {icon && <Icon name={icon} size={18} strokeWidth={2.2} />}
      {children}
    </Link>
  );
}

// ── الشارات ─────────────────────────────────────────────────
const tones: Record<Tone, string> = {
  brand: "bg-sky text-brand",
  orange: "bg-orange-soft text-orange-ink",
  purple: "bg-purple-soft text-purple",
  green: "bg-green-soft text-green",
  teal: "bg-teal-soft text-teal-ink",
  danger: "bg-danger-soft text-danger-ink",
  neutral: "bg-chip text-[#556274]",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

// ── الحقول ──────────────────────────────────────────────────
const control =
  "w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-4 focus:ring-sky aria-invalid:border-danger";

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-[13px] font-semibold text-body">{label}</span>
      {children}
      {error ? <span className="text-xs font-medium text-danger-ink">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(control, "h-11", className)} {...p} />;
}

export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(control, "h-11", className)} {...p} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(control, "min-h-24 py-2.5 leading-7", className)} {...p} />;
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-center gap-2 rounded-xl border-[1.5px] border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-ink">
      <Icon name="alert" size={18} />
      {message}
    </div>
  );
}

// ── عناصر الصفحة ────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-4">
      <div className="min-w-60 flex-1">
        <h1 className="text-2xl font-extrabold md:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </header>
  );
}

const statAccents = {
  brand: { bar: "from-brand", ic: "bg-sky text-brand", sub: "text-brand" },
  orange: { bar: "from-orange", ic: "bg-orange-soft text-orange-ink", sub: "text-orange-ink" },
  purple: { bar: "from-purple", ic: "bg-purple-soft text-purple", sub: "text-purple" },
  green: { bar: "from-green", ic: "bg-green-soft text-green", sub: "text-green" },
} as const;

export function StatCard({ label, value, sub, icon, accent }: { label: string; value: ReactNode; sub?: ReactNode; icon: IconName; accent: keyof typeof statAccents }) {
  const a = statAccents[accent];
  return (
    <Card className="relative overflow-hidden p-4 md:px-5 md:py-5">
      <div className={cx("absolute inset-x-0 top-0 h-1 bg-linear-to-l to-transparent", a.bar)} />
      <div className={cx("hidden size-11 place-items-center rounded-[14px] md:grid", a.ic)}>
        <Icon name={icon} size={22} strokeWidth={2} />
      </div>
      <div className="tabular mt-2 text-2xl leading-none font-extrabold md:mt-4 md:text-3xl">{value}</div>
      <div className="mt-2 text-xs font-semibold text-muted md:text-[13px]">{label}</div>
      {sub && <div className={cx("mt-2 hidden text-xs font-semibold md:block", a.sub)}>{sub}</div>}
    </Card>
  );
}

const avatarTones = ["bg-sky text-brand", "bg-orange-soft text-orange-ink", "bg-purple-soft text-purple", "bg-green-soft text-green", "bg-teal-soft text-teal-ink"];

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const tone = avatarTones[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % avatarTones.length];
  return (
    <span className={cx("grid flex-none place-items-center rounded-full font-bold", tone, size === "md" ? "size-9 text-sm" : "size-14 text-xl")}>
      {[...name.trim()][0] ?? "؟"}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-sky text-brand">
        <Icon name={icon} size={26} />
      </span>
      <p className="font-bold">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}
