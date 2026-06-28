-- CreateTable
CREATE TABLE "makes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "makes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models" (
    "id" UUID NOT NULL,
    "make_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body_type" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" UUID NOT NULL,
    "model_id" UUID,
    "year" INTEGER NOT NULL,
    "trim_name" TEXT,
    "engine_size_cc" INTEGER,
    "fuel_type" TEXT,
    "transmission" TEXT,
    "horsepower" INTEGER,
    "torque_nm" INTEGER,
    "zero_to_sixty" DECIMAL(4,2),
    "top_speed_mph" INTEGER,
    "doors" INTEGER,
    "seats" INTEGER,
    "kerb_weight_kg" INTEGER,
    "mpg_urban" DECIMAL(5,1),
    "mpg_extra_urban" DECIMAL(5,1),
    "mpg_combined" DECIMAL(5,1),
    "co2_gkm" INTEGER,
    "ved_annual_gbp" INTEGER,
    "data_source" TEXT NOT NULL,
    "data_fetched_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalls" (
    "id" UUID NOT NULL,
    "model_id" UUID,
    "nhtsa_campaign_id" TEXT,
    "year_from" INTEGER,
    "year_to" INTEGER,
    "component" TEXT,
    "summary" TEXT,
    "consequence" TEXT,
    "remedy" TEXT,
    "recall_date" DATE,
    "data_source" TEXT NOT NULL,
    "data_fetched_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recalls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "model_id" UUID,
    "variant_year" INTEGER,
    "component" TEXT,
    "summary" TEXT,
    "complaint_date" DATE,
    "crash_involved" BOOLEAN,
    "injury_involved" BOOLEAN,
    "data_source" TEXT NOT NULL,
    "data_fetched_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tsbs" (
    "id" UUID NOT NULL,
    "model_id" UUID,
    "year_from" INTEGER,
    "year_to" INTEGER,
    "component" TEXT,
    "summary" TEXT,
    "tsb_number" TEXT,
    "data_source" TEXT NOT NULL,
    "data_fetched_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tsbs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "username" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "model_id" UUID,
    "variant_year" INTEGER,
    "ownership_months" INTEGER,
    "annual_mileage" INTEGER,
    "reliability_rating" INTEGER,
    "running_cost_rating" INTEGER,
    "real_world_mpg" DECIMAL(5,1),
    "monthly_fuel_cost_gbp" DECIMAL(7,2),
    "monthly_insurance_gbp" DECIMAL(7,2),
    "annual_servicing_gbp" DECIMAL(7,2),
    "title" TEXT,
    "body" TEXT,
    "known_issues" TEXT,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "makes_name_key" ON "makes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "makes_slug_key" ON "makes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "models_slug_key" ON "models"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "makes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalls" ADD CONSTRAINT "recalls_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tsbs" ADD CONSTRAINT "tsbs_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: profiles extends auth.users (Supabase-managed schema, not modeled by Prisma)
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint: ratings are 1-5, nullable (Prisma schema can't express CHECK constraints)
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reliability_rating_check" CHECK ("reliability_rating" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_running_cost_rating_check" CHECK ("running_cost_rating" BETWEEN 1 AND 5);

-- ============================================================================
-- Row Level Security — every table, no exceptions, from day one.
-- Baseline policies per 01-Specification/Database-Schema.md §RLS Policies.
-- ============================================================================

ALTER TABLE "makes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recalls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "complaints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tsbs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;

-- Sourced data: public read, no public write. Only the service role (data pipeline,
-- which bypasses RLS entirely) inserts/updates/deletes. Authenticated/anon get SELECT only.
CREATE POLICY "makes_public_read" ON "makes" FOR SELECT USING (true);
CREATE POLICY "models_public_read" ON "models" FOR SELECT USING (true);
CREATE POLICY "variants_public_read" ON "variants" FOR SELECT USING (true);
CREATE POLICY "recalls_public_read" ON "recalls" FOR SELECT USING (true);
CREATE POLICY "complaints_public_read" ON "complaints" FOR SELECT USING (true);
CREATE POLICY "tsbs_public_read" ON "tsbs" FOR SELECT USING (true);

-- profiles: users read and update their own row only.
CREATE POLICY "profiles_select_own" ON "profiles" FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON "profiles" FOR UPDATE USING (auth.uid() = id);
-- Row creation happens via a trigger/server logic on signup (service role), not a public INSERT
-- policy — no client-side INSERT policy is defined on purpose.

-- reviews: insert own, read approved reviews (or your own unapproved ones), update/delete own only.
CREATE POLICY "reviews_insert_own" ON "reviews" FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_select_approved_or_own" ON "reviews" FOR SELECT USING (is_approved = true OR auth.uid() = user_id);
CREATE POLICY "reviews_update_own" ON "reviews" FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reviews_delete_own" ON "reviews" FOR DELETE USING (auth.uid() = user_id);
