import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { OnboardingForm } from "./form";

export const metadata: Metadata = { title: "إعداد العيادة" };

export default async function OnboardingPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { count } = await supabase.from("clinic_members").select("clinic_id", { count: "exact", head: true }).eq("user_id", user.id);
  if (count) redirect("/");
  return <OnboardingForm />;
}
