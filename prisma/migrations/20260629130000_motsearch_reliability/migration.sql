-- Phase 2.5b — extend mot_reliability for the motsearch faults-per-100-tests signal.
-- The DVSA-bulk-oriented columns (test_count, pass_rate) become optional; add the per-model-year
-- defect-rate-vs-average columns motsearch provides. Table is empty, so no backfill needed.

ALTER TABLE "mot_reliability" ALTER COLUMN "test_count" DROP NOT NULL;
ALTER TABLE "mot_reliability" ALTER COLUMN "pass_rate" DROP NOT NULL;
ALTER TABLE "mot_reliability" ADD COLUMN "defects_per_100" DECIMAL(6,2);
ALTER TABLE "mot_reliability" ADD COLUMN "year_avg_per_100" DECIMAL(6,2);
ALTER TABLE "mot_reliability" ADD COLUMN "sample_cars" INTEGER;
