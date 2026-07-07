"use client";

// Header auth state. Client-side on purpose: reading cookies in the root layout would force
// every page dynamic. getSession() here is display-only — anything security-relevant goes
// through server-side getUser() (lib/auth/user.ts).
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/app/(auth)/actions";

export function AuthMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setLoaded(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!loaded) return <span className="w-16" aria-hidden />;

  if (!email) {
    return (
      <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white">
        Sign in
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-3 text-sm text-slate-300">
      <span className="hidden max-w-40 truncate sm:inline" title={email}>
        {email}
      </span>
      <form action={signOutAction}>
        <button type="submit" className="font-medium hover:text-white">
          Sign out
        </button>
      </form>
    </span>
  );
}
