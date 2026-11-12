import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { supabaseEnv } from "./env";

/**
 * عميل Supabase للخادم، يعمل بجلسة المستخدم الحالي.
 * كل استعلام يمر عبر سياسات RLS — لا يوجد مفتاح خدمة في التطبيق.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // استدعاء من Server Component: proxy.ts يتولى تحديث الجلسة
        }
      },
    },
  });
}
