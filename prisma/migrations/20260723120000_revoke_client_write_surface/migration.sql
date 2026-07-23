-- Sprint-1 security fix (2026-07-23): close the client DELETE path on `reviews` that the
-- 2026-07-08 revoke missed, then finish the job across the whole schema.
--
-- The 2026-07-08 migration revoked INSERT and UPDATE on `reviews`, stating the model plainly:
-- "Client roles get NO CRUD grants on `reviews`." But Supabase's default privileges grant ALL on
-- every table in `public` to anon/authenticated, so DELETE was still granted — and the init
-- migration's `reviews_delete_own` policy actively permits it. Net effect: a signed-in user with
-- only the anon key could DELETE their own review rows via PostgREST, bypassing the server
-- entirely. Because the rate limiter counts existing rows in the window (lib/reviews/queries.ts),
-- delete-and-repost also defeats the 3-per-hour cap the SERIALIZABLE limiter exists to enforce.
REVOKE DELETE ON "reviews" FROM anon, authenticated;
DROP POLICY IF EXISTS "reviews_delete_own" ON "reviews";

-- Same-verb sweep across every table, so this bug class (one verb slipping through) is closed for
-- good rather than per-finding. Nothing in this app touches the database from the client — there
-- is no supabase-js `.from()` call anywhere; every read and write goes through server-side Prisma
-- — so client roles need no write privileges on any table. Revoking an absent grant is a no-op,
-- so this is safe against any environment regardless of which defaults were applied.
REVOKE INSERT, UPDATE, DELETE ON
  "makes", "models", "variants", "recalls", "complaints", "tsbs",
  "mot_reliability", "profiles", "reviews"
FROM anon, authenticated;

-- Drop the remaining client-write policies too. The 2026-07-08 migration kept
-- `reviews_insert_own`/`reviews_update_own` as "inert belt-and-braces", but a permissive policy
-- is the opposite of a safety net: with grants revoked it does nothing, and if a write grant ever
-- returns (e.g. default privileges re-applied by a platform migration) the policy *re-opens* the
-- client write path. Default-deny RLS with no write policy is the state that actually fails
-- closed. SELECT policies are untouched — public reads and own-row reads work exactly as before.
DROP POLICY IF EXISTS "reviews_insert_own" ON "reviews";
DROP POLICY IF EXISTS "reviews_update_own" ON "reviews";
DROP POLICY IF EXISTS "profiles_update_own" ON "profiles";
