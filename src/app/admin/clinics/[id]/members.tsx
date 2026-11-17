"use client";

import { useActionState, useState } from "react";
import { Badge, Button, Field, FormError, Input, Select } from "@/components/ui";
import { ROLE } from "@/lib/labels";
import type { AdminMemberRow } from "@/lib/supabase/types";
import { addMember, removeMember, resetPassword } from "../../actions";
import { Credentials } from "../../credentials";

function ResetPassword({ clinicId, userId }: { clinicId: string; userId: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const f = state?.fields ?? {};
  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <input type="hidden" name="clinic_id" value={clinicId} />
        <input type="hidden" name="user_id" value={userId} />
        <Button variant="ghost" className="min-h-9 px-2.5 text-xs" disabled={pending}>{pending ? "..." : "كلمة مرور جديدة"}</Button>
      </form>
      <FormError message={state?.error} />
      {f.ok === "1" && f.password && <Credentials name={f.name ?? ""} email={f.email ?? ""} password={f.password} title="كلمة المرور الجديدة" />}
    </div>
  );
}

function RemoveMember({ clinicId, userId, name }: { clinicId: string; userId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(removeMember, undefined);
  if (!confirming) {
    return <Button variant="ghost" className="min-h-9 px-2.5 text-xs" onClick={() => setConfirming(true)}>إزالة</Button>;
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="clinic_id" value={clinicId} />
      <input type="hidden" name="user_id" value={userId} />
      <span className="text-xs text-danger-ink">يُحذف حساب {name} نهائياً</span>
      <Button variant="danger" className="min-h-9 px-2.5 text-xs" disabled={pending}>{pending ? "..." : "تأكيد الإزالة"}</Button>
      <Button type="button" variant="ghost" className="min-h-9 px-2.5 text-xs" onClick={() => setConfirming(false)}>إلغاء</Button>
      <FormError message={state?.error} />
    </form>
  );
}

export function MemberList({ clinicId, members, tz }: { clinicId: string; members: AdminMemberRow[]; tz: string }) {
  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("ar-SY-u-nu-latn", { timeZone: tz, dateStyle: "medium" }).format(new Date(iso)) : "لم يدخل بعد";
  return (
    <ul>
      {members.map((m) => (
        <li key={m.user_id} className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-divider py-3 first:border-t-0">
          <div className="min-w-48 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {m.full_name}
              <Badge tone={m.role === "owner" ? "brand" : m.role === "doctor" ? "purple" : "teal"}>{ROLE[m.role]}</Badge>
            </div>
            <div className="mt-0.5 text-xs text-muted"><span dir="ltr">{m.email}</span> · آخر دخول: {fmt(m.last_sign_in_at)}</div>
          </div>
          <div className="flex flex-wrap items-start gap-1">
            <ResetPassword clinicId={clinicId} userId={m.user_id} />
            {m.role !== "owner" && <RemoveMember clinicId={clinicId} userId={m.user_id} name={m.full_name} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AddMemberForm({ clinicId, full }: { clinicId: string; full: boolean }) {
  const [state, action, pending] = useActionState(addMember, undefined);
  const f = state?.fields ?? {};
  return (
    <div className="flex flex-col gap-3">
      {f.ok === "1" && f.password && <Credentials name={f.name ?? ""} email={f.email ?? ""} password={f.password} title="أُضيف العضو" />}
      <form key={f.password ?? "form"} action={action} className="grid gap-3 md:grid-cols-[1.2fr_1.2fr_0.8fr_auto] md:items-end">
        <div className="md:col-span-4"><FormError message={state?.error} /></div>
        <input type="hidden" name="clinic_id" value={clinicId} />
        <Field label="الاسم" error={f.full_name}><Input name="full_name" required /></Field>
        <Field label="البريد (للدخول)" error={f.email}><Input name="email" type="email" dir="ltr" required autoComplete="off" /></Field>
        <Field label="الدور">
          <Select name="role" defaultValue="doctor">
            <option value="doctor">طبيب</option>
            <option value="secretary">سكرتارية</option>
          </Select>
        </Field>
        <Button type="submit" icon="plus" disabled={pending || full}>{pending ? "..." : "إضافة"}</Button>
      </form>
      {full && <p className="text-xs text-orange-ink">العيادة وصلت إلى حد الطاقم في خطتها. غيّر الخطة أو ضع حداً خاصاً أولاً.</p>}
    </div>
  );
}
