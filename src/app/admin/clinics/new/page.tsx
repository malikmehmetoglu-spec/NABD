import { getUser } from "@/lib/session";
import { addDays, todayIn } from "@/lib/time";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { adminMetadata } from "../../metadata";
import { PLATFORM_TIMEZONE } from "../../config";
import { NewClinicForm } from "./form";

export const generateMetadata = () => adminMetadata("عيادة جديدة");

export default async function NewClinicPage() {
  const { supabase } = await getUser();
  const { data: plans } = await supabase.from("plans").select("*").order("sort");
  return (
    <>
      <PageHeader title="عيادة جديدة" subtitle="ينشئ العيادة وحساب دخول لمالكها" actions={<LinkButton href="/admin" variant="secondary">كل العيادات</LinkButton>} />
      <Card className="max-w-3xl p-5 md:p-6">
        <NewClinicForm plans={plans ?? []} defaultExpiry={addDays(todayIn(PLATFORM_TIMEZONE), 14)} />
      </Card>
    </>
  );
}
