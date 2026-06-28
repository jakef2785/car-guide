// Browser Supabase client (anon/publishable key only — RLS governs everything it can do).
// Use this in Client Components only. Never import lib/supabase/admin here.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
