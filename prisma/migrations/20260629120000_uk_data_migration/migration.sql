-- Phase 2.5 UK data migration.
-- 1) Rename recalls.nhtsa_campaign_id -> campaign_ref (now also holds DVSA recall refs).
-- 2) Add mot_reliability table (DVSA MOT reliability signal) with public-read RLS.

-- RenameColumn (explicit rename preserves any existing data, unlike Prisma's default drop+add)
ALTER TABLE "recalls" RENAME COLUMN "nhtsa_campaign_id" TO "campaign_ref";

-- CreateTable
CREATE TABLE "mot_reliability" (
    "id" UUID NOT NULL,
    "model_id" UUID,
    "age_band" TEXT,
    "test_count" INTEGER NOT NULL,
    "pass_rate" DECIMAL(5,2) NOT NULL,
    "top_failures" TEXT[],
    "data_source" TEXT NOT NULL,
    "data_fetched_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mot_reliability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mot_reliability_model_id_idx" ON "mot_reliability"("model_id");

-- AddForeignKey
ALTER TABLE "mot_reliability" ADD CONSTRAINT "mot_reliability_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: public read, service-role-only write (matches every other sourced table).
-- See 01-Specification/Database-Schema.md §RLS Policies.
ALTER TABLE "mot_reliability" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mot_reliability_public_read" ON "mot_reliability" FOR SELECT USING (true);
