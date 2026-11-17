import { getUser } from "@/lib/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ChangePasswordForm } from "@/components/change-password-form";
import { adminMetadata } from "../metadata";

export const generateMetadata = () => adminMetadata("حسابي");

export default async function AdminAccountPage() {
  const { user } = await getUser();
  return (
    <>
      <PageHeader title="حسابي" subtitle={<span dir="ltr">{user?.email}</span>} />
      <Card className="max-w-3xl p-5 md:p-6">
        <CardHeader title="تغيير كلمة المرور" />
        <ChangePasswordForm />
      </Card>
    </>
  );
}
