"use client";

// Shared login/signup form. Client-side checks are UX only — the server actions re-validate
// everything independently (Security-Requirements.md).
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import {
  signInAction,
  signUpAction,
  signInWithGoogleAction,
  type AuthFormState,
} from "@/app/(auth)/actions";

const INITIAL: AuthFormState = { error: null, message: null };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? signInAction : signUpAction;
  const [state, formAction] = useFormState(action, INITIAL);

  return (
    <div className="mx-auto mt-12 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold text-charcoal">
        {mode === "login" ? "Sign in" : "Create an account"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {mode === "login"
          ? "Sign in to write and manage your reviews."
          : "You'll need to verify your email before posting a review."}
      </p>

      <form action={formAction} className="mt-5 flex flex-col gap-3">
        <label className="text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={mode === "signup" ? 8 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-sm text-green-700">
            {state.message}
          </p>
        )}

        <SubmitButton label={mode === "login" ? "Sign in" : "Sign up"} />
      </form>

      <form action={signInWithGoogleAction} className="mt-3">
        <button
          type="submit"
          className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Continue with Google
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-500">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/signup" className="font-medium text-charcoal underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="font-medium text-charcoal underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
