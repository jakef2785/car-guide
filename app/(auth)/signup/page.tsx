import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <main className="px-4 pb-12">
      <AuthForm mode="signup" />
    </main>
  );
}
