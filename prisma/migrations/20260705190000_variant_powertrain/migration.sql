-- Store the raw VCA "Powertrain" string per variant. Distinguishes plug-in hybrids (whose WLTP
-- MPG is the non-comparable "weighted" figure) from full hybrids/ICE for scoring.
ALTER TABLE "variants" ADD COLUMN "powertrain" TEXT;
