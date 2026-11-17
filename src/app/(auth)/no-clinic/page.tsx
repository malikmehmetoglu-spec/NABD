import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { signOut } from "../actions";
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contact";

export const metadata: Metadata = { title: "الحساب غير مرتبط بعيادة" };

/** حساب موجود لكنه ليس عضواً في أي عيادة (مثلاً بعد إزالته من الطاقم) */
export default async function NoClinicPage() {
  const { user } = await getUser();
  if (!user) redirect("/login");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[26px] font-extrabold">الحساب غير مرتبط بعيادة</h1>
      <p className="text-sm leading-7 text-muted">
        حسابك ({user.email}) ليس عضواً في أي عيادة حالياً. إن كنت تتوقع الوصول إلى عيادة، تواصل مع مالكها أو مع فريق نبض على واتساب{" "}
        <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-semibold">{SUPPORT_WHATSAPP_DISPLAY}</a>.
      </p>
      <form action={signOut}>
        <button className="text-sm font-semibold text-brand hover:underline">تسجيل الخروج</button>
      </form>
    </div>
  );
}
