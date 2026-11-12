import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { formatDate } from "@/lib/time";
import { ROLE } from "@/lib/labels";
import { Avatar, Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { ClinicForm, NameForm } from "./forms";
import { createInvite, removeMember, revokeInvite } from "./actions";

export const metadata: Metadata = { title: "إعدادات العيادة" };

export default async function SettingsPage() {
  const { supabase, clinic, member } = await requireSession();
  const owner = member.role === "owner";
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("clinic_members").select("*").order("created_at"),
    owner
      ? supabase.from("clinic_invites").select("*").is("used_by", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

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
