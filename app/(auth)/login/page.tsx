import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="px-4 pb-12">
      {searchParams.error && (
        <p role="alert" className="mx-auto mt-6 w-full max-w-sm rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          Sign-in didn&apos;t complete — please try again.
        </p>
      )}
      <AuthForm mode="login" />
    </main>
  );
}
