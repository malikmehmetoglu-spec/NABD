import type { Metadata } from "next";
import { isPlatformAdmin } from "@/lib/session";

/** عنوان الصفحة للأدمن فقط؛ غيره يرى عنوان صفحة غير موجودة فلا يُكشف وجود اللوحة */
export async function adminMetadata(title: string): Promise<Metadata> {
  return { title: (await isPlatformAdmin()) ? title : "الصفحة غير موجودة" };
}
