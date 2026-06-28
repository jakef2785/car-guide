// Phase 1 fuel-economy ingestion — matches EPA's bulk vehicles.csv against the variants already
// seeded by scripts/seed.ts, converts US MPG to UK imperial MPG, and computes CO2/VED.
//
// VCA (the spec's intended UK source) is deferred — see vault decision 0003. Its download
// portal is a session-gated legacy ASP.NET app that wouldn't serve a file on direct request,
// and our current seed set is US-market vehicles from CarVector anyway, which wouldn't match
// VCA's UK-market catalogue cleanly. EPA is a clean direct download and matches our seed set's
// actual market. Source: https://www.fueleconomy.gov/feg/epadata/vehicles.csv, downloaded
// 2026-06-28 (21.6MB, all model years 1984-2027), saved at data/epa/vehicles.csv (gitignored —
// re-download to regenerate).
//
// Run with: npx tsx scripts/match-epa-fuel-economy.ts
//
// No fabricated data: a variant with no confident EPA match is left with null mpg/co2/ved
// fields, same principle as scripts/seed.ts. Match coverage is printed at the end so gaps are
// visible, not silently swallowed.

import { readFileSync } from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";
import { usMpgToUkMpg, roundMpg } from "../lib/utils/mpg-convert";
import { calculateFirstYearVed, categorizeFuelType } from "../lib/data-pipeline/ved";

const prisma = new PrismaClient();

interface EpaRow {
  make: string;
  model: string;
  year: string;
  comb08: string;
  city08: string;
  highway08: string;
  co2TailpipeGpm: string;
  fuelType1: string;
}

const MILES_PER_KM = 0.621371; // exact-enough conversion factor (1 / 1.609344)

// Strips trailing drivetrain/door-count tokens EPA appends to model names (e.g. "CR-V AWD" ->
// "CR-V", "Civic 4Dr" -> "Civic") so they line up with CarVector's bare model names. Deliberately
// does NOT strip trim names (e.g. "Badlands", "Hybrid") — those are meaningful distinctions we
// either match on purpose (via variant trim) or correctly fail to match rather than guess.
function normalizeModelBase(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\b(4wd|awd|fwd|rwd|2wd|4dr|5dr|2dr|3dr)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadEpaRows(): EpaRow[] {
  const csvPath = path.join(__dirname, "..", "data", "epa", "vehicles.csv");
  const raw = readFileSync(csvPath, "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true }) as EpaRow[];
}

async function main() {
  console.log("Loading EPA dataset...");
  const epaRows = loadEpaRows();
  console.log(`Loaded ${epaRows.length} EPA rows.`);

  const variants = await prisma.variant.findMany({
    include: { model: { include: { make: true } } },
  });
  console.log(`Matching against ${variants.length} seeded variants.`);

  let matched = 0;
  let noCandidates = 0;
  let evSkippedMpg = 0;

  for (const variant of variants) {
    const make = variant.model?.make?.name;
    const modelName = variant.model?.name;
    if (!make || !modelName) continue;

    const sameMakeYear = epaRows.filter(
      (r) => r.make.trim().toLowerCase() === make.toLowerCase() && Number(r.year) === variant.year,
    );

    const normalizedTarget = normalizeModelBase(modelName);

    // Prefer trim-specific matches (e.g. variant trim "Badlands" -> EPA model "Bronco Badlands
    // 4WD") when we have a trim name and one exists; otherwise fall back to a base-model match.
    let candidates = sameMakeYear.filter((r) => normalizeModelBase(r.model) === normalizedTarget);

    if (variant.trimName) {
      const trimLower = variant.trimName.toLowerCase();
      const trimMatches = sameMakeYear.filter((r) => r.model.toLowerCase().includes(trimLower));
      if (trimMatches.length > 0) candidates = trimMatches;
    }

    if (candidates.length === 0) {
      noCandidates++;
      continue;
    }

    const isElectric = categorizeFuelType(variant.fuelType).startsWith("electric");

    // co2TailpipeGpm is genuinely 0 for EVs (no tailpipe), so it's still a real, usable value.
    // comb08/city08/highway08 (US MPG) are not meaningful for EVs (EPA reports those as 0 and
    // uses a separate MPGe field we don't currently consume) — skip MPG for EVs rather than
    // store a zero that would render as "0 mpg".
    const avg = (key: keyof EpaRow) => {
      const nums = candidates.map((c) => Number(c[key])).filter((n) => !Number.isNaN(n) && n > 0);
      return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    };

    const co2TailpipeGpmAvg = candidates
      .map((c) => Number(c.co2TailpipeGpm))
      .filter((n) => !Number.isNaN(n) && n >= 0);
    const co2Gkm =
      co2TailpipeGpmAvg.length > 0
        ? Math.round((co2TailpipeGpmAvg.reduce((a, b) => a + b, 0) / co2TailpipeGpmAvg.length) * MILES_PER_KM)
        : null;

    let mpgCombined: number | null = null;
    let mpgUrban: number | null = null;
    let mpgExtraUrban: number | null = null;

    if (!isElectric) {
      const combUs = avg("comb08");
      const cityUs = avg("city08");
      const hwyUs = avg("highway08");
      mpgCombined = combUs !== null ? roundMpg(usMpgToUkMpg(combUs)) : null;
      // UK "urban"/"extra urban" labels map approximately onto EPA's city/highway cycles — the
      // underlying test procedures differ (EPA vs UK NEDC/WLTP), so treat this as an
      // approximation, not an official UK-equivalent figure (see decision 0003).
      mpgUrban = cityUs !== null ? roundMpg(usMpgToUkMpg(cityUs)) : null;
      mpgExtraUrban = hwyUs !== null ? roundMpg(usMpgToUkMpg(hwyUs)) : null;
      if (mpgCombined === null) evSkippedMpg++;
    } else {
      evSkippedMpg++;
    }

    const ved = calculateFirstYearVed(co2Gkm, variant.fuelType);

    await prisma.variant.update({
      where: { id: variant.id },
      data: {
        mpgCombined,
        mpgUrban,
        mpgExtraUrban,
        co2Gkm,
        vedAnnualGbp: ved.firstYearRateGbp,
      },
    });

    matched++;
    console.log(
      `  ${variant.year} ${make} ${modelName}${variant.trimName ? " " + variant.trimName : ""}: ` +
        `mpg=${mpgCombined ?? "n/a"} co2=${co2Gkm ?? "n/a"}g/km ved=£${ved.firstYearRateGbp}` +
        `${ved.assumptionApplied ? " (diesel RDE2 assumed non-compliant)" : ""} (${candidates.length} EPA row(s) averaged)`,
    );
  }

  console.log(`\nMatched ${matched}/${variants.length} variants.`);
  console.log(`No EPA candidates found for ${noCandidates} variants (left null — not fabricated).`);
  console.log(`${evSkippedMpg} variants skipped MPG as electric (CO2 still set where available).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
