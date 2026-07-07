-- Phase 4 (Auth & Reviews): moderation hardening + profile auto-creation.
-- Design: vault 02-Phases/Phase-4-Design.md.

-- ============================================================================
-- 1. Moderation audit trail.
-- ============================================================================
ALTER TABLE "reviews" ADD COLUMN "approved_at" TIMESTAMPTZ;
ALTER TABLE "reviews" ADD COLUMN "approved_by" UUID;

-- ============================================================================
-- 2. Close the self-approval hole.
-- The init migration's reviews_update_own policy lets a user UPDATE their own row — and RLS
-- cannot restrict WHICH columns, so a signed-in user could set is_approved = true on their own
-- review through the Supabase REST API. Column-level privileges can restrict columns: revoke
-- table-wide INSERT/UPDATE from client roles and grant back only the user-editable columns.
-- Moderation columns (is_approved, approved_at, approved_by) are writable by the service role
-- and the server (Prisma) only.
-- ============================================================================
REVOKE INSERT, UPDATE ON "reviews" FROM anon, authenticated;
GRANT INSERT (
  "user_id", "model_id", "variant_year", "ownership_months", "annual_mileage",
  "reliability_rating", "running_cost_rating", "real_world_mpg", "monthly_fuel_cost_gbp",
  "monthly_insurance_gbp", "annual_servicing_gbp", "title", "body", "known_issues"
) ON "reviews" TO authenticated;
GRANT UPDATE (
  "variant_year", "ownership_months", "annual_mileage",
  "reliability_rating", "running_cost_rating", "real_world_mpg", "monthly_fuel_cost_gbp",
  "monthly_insurance_gbp", "annual_servicing_gbp", "title", "body", "known_issues"
) ON "reviews" TO authenticated;

-- ============================================================================
-- 3. Re-moderation on edit: any content change resets approval, so edited reviews go back
-- through the queue. Admin approval only touches the moderation columns, so it does not
-- retrigger this.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.requeue_review_on_content_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title
    OR NEW.body IS DISTINCT FROM OLD.body
    OR NEW.known_issues IS DISTINCT FROM OLD.known_issues
    OR NEW.reliability_rating IS DISTINCT FROM OLD.reliability_rating
    OR NEW.running_cost_rating IS DISTINCT FROM OLD.running_cost_rating
    OR NEW.real_world_mpg IS DISTINCT FROM OLD.real_world_mpg
    OR NEW.monthly_fuel_cost_gbp IS DISTINCT FROM OLD.monthly_fuel_cost_gbp
    OR NEW.monthly_insurance_gbp IS DISTINCT FROM OLD.monthly_insurance_gbp
    OR NEW.annual_servicing_gbp IS DISTINCT FROM OLD.annual_servicing_gbp
    OR NEW.variant_year IS DISTINCT FROM OLD.variant_year
    OR NEW.ownership_months IS DISTINCT FROM OLD.ownership_months
    OR NEW.annual_mileage IS DISTINCT FROM OLD.annual_mileage
  THEN
    NEW.is_approved := false;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_requeue_on_content_edit ON "reviews";
CREATE TRIGGER reviews_requeue_on_content_edit
  BEFORE UPDATE ON "reviews"
  FOR EACH ROW
  EXECUTE FUNCTION public.requeue_review_on_content_edit();

-- ============================================================================
-- 4. Profile auto-creation on signup. A DB trigger covers email/password AND OAuth signups
-- uniformly — no server code path to forget. SECURITY DEFINER because profiles has (by design)
-- no client INSERT policy.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
