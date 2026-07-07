// Server-side auth helpers. Always getUser() (JWT validated against Supabase), never
// getSession() alone, for anything security-relevant — see Security-Requirements.md.
import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "./claims";

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Returns the user only if they carry the admin claim; null otherwise. Every admin page AND
// every admin server action calls this independently — never trust that the page gated the
// action (defence-in-depth, Phase-4-Design.md).
export async function getAdminUser(): Promise<User | null> {
  const user = await getUser();
  return user && isAdmin(user) ? user : null;
}
