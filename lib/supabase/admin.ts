// Service-role Supabase client — DATA PIPELINE ONLY. Bypasses RLS entirely.
// Never import from Client Components, Server Components reachable by user requests, or
// anything that could end up in a browser bundle. The `server-only` import below makes any
// accidental client-side import a build error, not just a code-review catch.
// See vault: 01-Specification/Security-Requirements.md — "Service role key never exposed
// to the client — server-side pipeline only."
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — admin client must only run in the data pipeline " +
        "(server-side), never in a request path that could be reached without it.",
    );
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
