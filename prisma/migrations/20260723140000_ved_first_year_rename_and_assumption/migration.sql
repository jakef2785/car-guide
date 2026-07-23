-- Score-integrity fix (2026-07-23). Two changes to `variants`:
--
-- 1. `ved_annual_gbp` -> `ved_first_year_gbp`. The column has always held the CO2-banded
--    FIRST-YEAR VED rate (seed.ts stores calculateFirstYearVed().firstYearRateGbp), but the old
--    name led the running-cost criterion to sum it with recurring annual fuel — charging a
--    one-time tax (up to £5,690) as if it recurred yearly and systematically distorting the
--    /score ranking against high-CO2 cars. Rename only: values are semantically unchanged, so no
--    re-seed is required for this line. The scorer now uses the flat £200 standard annual rate.
--
-- 2. `ved_assumption_applied`: persists the RDE2 flag calculateFirstYearVed() already returns
--    but the seed previously discarded. Diesels default to the higher non-RDE2 band when NOx
--    compliance is unknown; the UI must show that caveat from data, not by guessing off the fuel
--    type. Backfilled by the next seed run (default false until then).
ALTER TABLE "variants" RENAME COLUMN "ved_annual_gbp" TO "ved_first_year_gbp";
ALTER TABLE "variants" ADD COLUMN "ved_assumption_applied" BOOLEAN NOT NULL DEFAULT false;
