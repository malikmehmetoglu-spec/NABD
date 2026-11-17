import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * إدارة حسابات الدخول (إنشاء، إعادة تعيين كلمة المرور، حذف) بمفتاح Supabase السري.
 * يُعيد auth.admin فقط — لا وصول للجداول بهذا المفتاح، فالبيانات تبقى خلف RLS.
 * يُستدعى من server actions لوحة الأدمن فقط، وبعد التحقق من أن المستدعي أدمن المنصة.
 */
export function authAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;
}

export const MISSING_SECRET = "المفتاح السري SUPABASE_SECRET_KEY غير مضبوط على الخادم، فلا يمكن إدارة حسابات الدخول. أضفه في إعدادات Vercel ثم أعد النشر.";
