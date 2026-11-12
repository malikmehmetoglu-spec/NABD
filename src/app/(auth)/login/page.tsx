import type { Metadata } from "next";
import { signIn } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="login" action={signIn} next={next} />;
}
