"use server";

// Auth server actions. All inputs Zod-validated server-side regardless of client checks
// (Security-Requirements.md: client and server validation are independent).
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error: string | null; message: string | null };

const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

const signUpSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

// The origin header is browser-set on server-action POSTs; fall back to the configured site
// URL (production) so OAuth/email redirects never end up with "null" as an origin.
function requestOrigin(): string {
  return headers().get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function friendlyAuthError(message: string): string {
  if (/email not confirmed/i.test(message))
    return "Confirm your email first — check your inbox for the verification link.";
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  return message;
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password.", message: null };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendlyAuthError(error.message), message: null };
  redirect("/");
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Enter a valid email and password.";
    return { error: first, message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${requestOrigin()}/auth/callback` },
  });
  if (error) return { error: friendlyAuthError(error.message), message: null };
  // Same message whether or not the email already existed — Supabase deliberately doesn't
  // reveal which, and neither should we (account enumeration).
  return { error: null, message: "Check your email for a verification link to finish signing up." };
}

export async function signInWithGoogleAction(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${requestOrigin()}/auth/callback` },
  });
  if (data?.url) redirect(data.url);
  redirect("/login?error=oauth");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
