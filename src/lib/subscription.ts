import type { Clinic } from "@/lib/supabase/types";

/** حالة الوصول كما تفرضها قاعدة البيانات (can_write / is_member) */
export type Access = "active" | "expired" | "suspended";

export const READ_ONLY_MESSAGE = "انتهى اشتراك العيادة، والبيانات متاحة للقراءة فقط. تواصل مع نبض للتجديد.";

export function accessOf(clinic: Pick<Clinic, "status" | "expires_at">, now = Date.now()): Access {
  if (clinic.status === "suspended") return "suspended";
  return new Date(clinic.expires_at).getTime() > now ? "active" : "expired";
}
