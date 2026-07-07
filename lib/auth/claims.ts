// Admin identity check. The role claim lives in app_metadata, which only the service role /
// Supabase dashboard can set. user_metadata is user-editable via the client SDK, so a role
// found there is attacker-controlled and MUST be ignored — the type carries both fields to
// make that decision explicit.
type MaybeUser =
  | {
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    }
  | null
  | undefined;

export function isAdmin(user: MaybeUser): boolean {
  return user?.app_metadata?.role === "admin";
}
