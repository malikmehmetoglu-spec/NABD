import Link from "next/link";
import { Avatar, Badge } from "./ui";
import { STATUS } from "@/lib/labels";
import { formatTime } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/supabase/types";

export type AppointmentView = {
  id: string;
  starts_at: string;
  status: AppointmentStatus;
  reason: string | null;
  patient: { id: string; full_name: string };
  doctorName?: string;
};

export function AppointmentRow({ a, tz, actions }: { a: AppointmentView; tz: string; actions?: React.ReactNode }) {
  const s = STATUS[a.status];
  const faded = a.status === "completed" || a.status === "cancelled" || a.status === "no_show";
  return (
    <div className="grid grid-cols-[52px_1fr_auto] items-center gap-3 border-t border-divider py-3 first:border-t-0 md:grid-cols-[58px_1fr_auto] md:gap-3.5">
      <div className={`tabular text-sm font-bold md:text-[15px] ${faded ? "text-muted" : ""}`}>{formatTime(a.starts_at, tz)}</div>
      <Link href={`/patients/${a.patient.id}`} className="flex min-w-0 items-center gap-2.5 text-ink hover:text-brand">
        <span className="hidden sm:block"><Avatar name={a.patient.full_name} /></span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{a.patient.full_name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {[a.reason, a.doctorName].filter(Boolean).join(" · ") || "موعد"}
          </span>
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <Badge tone={s.tone}>
          {a.status === "in_progress" && <span className="size-1.5 rounded-full bg-brand" />}
          {a.status === "completed" && "✓ "}
          {s.label}
        </Badge>
        {actions}
      </div>
    </div>
  );
}
