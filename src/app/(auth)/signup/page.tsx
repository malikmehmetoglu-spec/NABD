import type { Metadata } from "next";
import { signUp } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "إنشاء حساب" };

export default function SignupPage() {
  return <AuthForm mode="signup" action={signUp} />;
}
