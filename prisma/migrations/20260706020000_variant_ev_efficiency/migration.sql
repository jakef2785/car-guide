-- Store VCA's EV efficiency (Miles/kWh) and max range per variant — enables scoring EVs on
-- running cost and showing real range/efficiency on the detail page (both were 100%/98%
-- covered in the raw CSV but not previously ingested).
ALTER TABLE "variants" ADD COLUMN "miles_per_kwh" DECIMAL(5,2);
ALTER TABLE "variants" ADD COLUMN "max_range_miles" INTEGER;
