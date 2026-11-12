import { z } from "zod";

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

/** يحوّل أخطاء zod إلى رسائل لكل حقل */
export function fieldErrors(err: z.ZodError): FormState {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    fields[key] ??= issue.message;
  }
  return { error: "تحقق من الحقول المظللة", fields };
}

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `الحد الأقصى ${max} حرف`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const optionalNumber = (min: number, max: number) =>
  z
    .union([z.literal(""), z.coerce.number().min(min, `القيمة بين ${min} و ${max}`).max(max, `القيمة بين ${min} و ${max}`)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));

/** قائمة مفصولة بفواصل → مصفوفة نظيفة */
export const tagList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(/[,،\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30),
  );

/** ترجمة أخطاء قاعدة البيانات الشائعة إلى رسائل مفهومة */
export function dbError(error: { code?: string; message: string } | null): string | undefined {
  if (!error) return undefined;
  if (error.message.includes("appointments_no_overlap")) return "الطبيب لديه موعد آخر في هذا الوقت";
  if (error.code === "42501") return "ليست لديك صلاحية لهذا الإجراء";
  if (error.code === "23514") return "إحدى القيم خارج الحدود المسموحة";
  if (error.code === "23505") return "هذا السجل موجود مسبقاً";
  console.error("database error", error);
  return "حدث خطأ غير متوقع، حاول مرة أخرى";
}
