import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Clinic, ClinicMember, MemberRole } from "@/lib/supabase/types";
import { accessOf, READ_ONLY_MESSAGE, type Access } from "@/lib/subscription";

export { READ_ONLY_MESSAGE };

export type Session = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  member: ClinicMember;
  clinic: Clinic;
  /** حالة الاشتراك كما تفرضها قاعدة البيانات: المنتهي للقراءة فقط، والمعلّق محجوب */
  access: Access;
};


/** هل المستخدم الحالي أدمن المنصة؟ */
export const isPlatformAdmin = cache(async () => {
  const { supabase, user } = await getUser();
  if (!user) return false;
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
});

/** المستخدم الحالي (أو null). يُحسب مرة واحدة لكل طلب. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
});

/**
 * يضمن وجود مستخدم مسجل وعضو في عيادة، وإلا يحوّله.
 * تستدعيه كل صفحة وكل server action قبل أي عمل.
 */
export const requireSession = cache(async (): Promise<Session> => {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("clinic_members")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!member) redirect((await isPlatformAdmin()) ? "/admin" : "/onboarding");

  const { data: clinic } = await supabase.from("clinics").select("*").eq("id", member.clinic_id).single();
  if (!clinic) redirect("/onboarding");

  return { supabase, userId: user.id, member, clinic, access: accessOf(clinic) };
});

/**
 * لـ server actions التي تكتب: تعيد الجلسة أو رسالة خطأ واضحة إن كان الاشتراك
 * غير فعّال. قاعدة البيانات ترفض الكتابة في كل الأحوال؛ هذا لرسالة مفهومة فقط.
 */
export async function requireWritable(): Promise<Session | { error: string }> {
  const session = await requireSession();
  return session.access === "active" ? session : { error: READ_ONLY_MESSAGE };
}

export function canWriteMedical(role: MemberRole) {
  return role === "owner" || role === "doctor";
}
