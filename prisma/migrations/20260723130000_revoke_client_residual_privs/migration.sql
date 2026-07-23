-- Companion to 20260723120000: verifying that migration against the live database showed
-- anon/authenticated still hold TRUNCATE, REFERENCES and TRIGGER on every table — the residue of
-- Supabase's default ALL grant. TRUNCATE is the worst of these: it empties a whole table and RLS
-- does NOT apply to it (policies only cover SELECT/INSERT/UPDATE/DELETE). PostgREST never emits
-- TRUNCATE so there is no open door today, but the entire point of this sweep is not depending on
-- that kind of accident. Revoke everything; client roles need no privileges on these tables at
-- all (no supabase-js table access exists anywhere in the app — SELECT was already absent from
-- the live grants and nothing broke, confirming reads are Prisma-only).
REVOKE ALL PRIVILEGES ON
  "makes", "models", "variants", "recalls", "complaints", "tsbs",
  "mot_reliability", "profiles", "reviews", "_prisma_migrations"
FROM anon, authenticated;

-- Stop the default ALL grant re-applying to tables created by future migrations (Prisma runs them
-- as the postgres role, whose default privileges are what granted ALL in the first place).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
