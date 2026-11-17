import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { formatDate } from "@/lib/time";
import { ROLE } from "@/lib/labels";
import { Avatar, Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { ClinicForm, NameForm } from "./forms";
import { createInvite, removeMember, revokeInvite } from "./actions";

export const metadata: Metadata = { title: "إعدادات العيادة" };

export default async function SettingsPage() {
  const { supabase, clinic, member, access } = await requireSession();
  const owner = member.role === "owner";
  const [{ data: members }, { data: invites }, { data: plan }, { data: limits }, { count: patientCount }] = await Promise.all([
    supabase.from("clinic_members").select("*").order("created_at"),
    owner
      ? supabase.from("clinic_invites").select("*").is("used_by", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("plans").select("name").eq("code", clinic.plan).maybeSingle(),
    supabase.rpc("clinic_limits", { p_clinic: clinic.id }),
    supabase.from("patients").select("id", { count: "exact", head: true }),
  ]);
  const usage = [
    { label: "الطاقم", used: members?.length ?? 0, max: limits?.max_staff ?? null },
    { label: "المرضى", used: patientCount ?? 0, max: limits?.max_patients ?? null },
  ];

  return (
    <>
      <PageHeader title="إعدادات العيادة" subtitle={owner ? undefined : "يمكن لمالك العيادة فقط تعديل هذه الإعدادات"} />

      <Card className="p-5 md:p-6">
        <CardHeader title="حسابي" />
        <NameForm name={member.full_name} />
      </Card>

      <Card className="p-5 md:p-6">
        <CardHeader title="معلومات العيادة" />
        <ClinicForm clinic={clinic} readOnly={!owner} />
      </Card>

      <Card className="p-5 md:p-6">
        <CardHeader
          title="الاشتراك"
          action={<Badge tone={access === "active" ? "green" : "danger"}>{access === "active" ? "فعّال" : "منتهٍ"}</Badge>}
        />
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">الخطة</dt>
            <dd className="mt-1 font-bold">{plan?.name ?? clinic.plan}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{access === "active" ? "ينتهي في" : "انتهى في"}</dt>
            <dd className="mt-1 font-bold">{formatDate(clinic.expires_at, clinic.timezone)}</dd>
          </div>
          {usage.map((u) => (
            <div key={u.label}>
              <dt className="text-xs text-muted">{u.label}</dt>
              <dd className="tabular mt-1 font-bold">{u.used}{u.max === null ? " · بلا حد" : ` من ${u.max}`}</dd>
              {u.max !== null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
                  <div className={u.used >= u.max ? "h-full bg-danger" : "h-full bg-brand"} style={{ width: `${Math.min(100, (u.used / u.max) * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted">للترقية أو التجديد تواصل مع إدارة نبض.</p>
      </Card>

      <Card className="p-5 md:p-6">
        <CardHeader title="طاقم العيادة" />
        <ul>
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 border-t border-divider py-3 first:border-t-0">
              <Avatar name={m.full_name} />
              <div className="flex-1">
                <div className="text-sm font-semibold">{m.full_name}{m.user_id === member.user_id && " (أنت)"}</div>
                <div className="text-xs text-muted">منذ {formatDate(m.created_at)}</div>
              </div>
              <Badge tone={m.role === "owner" ? "brand" : m.role === "doctor" ? "purple" : "teal"}>{ROLE[m.role]}</Badge>
              {owner && m.user_id !== member.user_id && (
                <form action={removeMember}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <Button variant="ghost" className="min-h-9 px-2.5 text-xs">إزالة</Button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {owner && (
          <div className="mt-5 rounded-2xl bg-canvas p-4">
            <h3 className="text-sm font-bold">دعوة عضو جديد</h3>
            <p className="mt-1 text-xs leading-6 text-muted">
              ولّد رمزاً وأرسله للطبيب أو السكرتير. ينشئ حساباً في نبض، ثم يختار &quot;الانضمام بدعوة&quot; ويدخل الرمز. الرمز صالح 7 أيام ولمرة واحدة.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={createInvite}><input type="hidden" name="role" value="doctor" /><Button variant="soft" icon="plus">رمز لطبيب</Button></form>
              <form action={createInvite}><input type="hidden" name="role" value="secretary" /><Button variant="soft" icon="plus">رمز لسكرتير</Button></form>
            </div>
            {!!invites?.length && (
              <ul className="mt-4">
                {invites.map((i) => (
                  <li key={i.code} className="flex items-center gap-3 border-t border-line py-2.5">
                    <code dir="ltr" className="rounded-lg bg-white px-2.5 py-1 text-sm font-bold tracking-widest text-brand select-all">{i.code}</code>
                    <span className="flex-1 text-xs text-muted">{ROLE[i.role]} · ينتهي {formatDate(i.expires_at)}</span>
                    <form action={revokeInvite}>
                      <input type="hidden" name="code" value={i.code} />
                      <Button variant="ghost" className="min-h-9 px-2.5 text-xs">إلغاء</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
