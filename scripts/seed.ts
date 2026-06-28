// Phase 1 seed script — pulls a real, small set of vehicles from CarVector, cross-references
// recalls (CarVector + NHTSA, per Data-Sources.md) and complaints (NHTSA), and upserts into the
// dev Supabase DB via Prisma. Run with: npx tsx scripts/seed.ts
//
// This is the data-pipeline entry point referenced in Phase 1's deliverable: "CarVector fetch ->
// Supabase insert for a small seed set (20-30 models)". Fuel economy (mpg_*, co2_gkm,
// ved_annual_gbp) is intentionally left null here — that's the VCA/EPA CSV step, not this one.
// No fabricated data: every value either comes straight from an API response or is left null.

import { PrismaClient } from "@prisma/client";
import {
  searchVehicles,
  getVehicleRecalls,
  parseCarVectorRecallDate,
} from "../lib/data-pipeline/carvector";
import {
  getRecallsByVehicle,
  getComplaintsByVehicle,
  parseNhtsaRecallDate,
} from "../lib/data-pipeline/nhtsa";

const prisma = new PrismaClient();

// A spread of makes for a representative seed set. CarVector's catalogue is US-centric
// (per Data-Sources.md caveat), so these are all US-market makes/models.
const ALL_SEED_MAKES = [
  "Toyota",
  "Honda",
  "Ford",
  "Chevrolet",
  "BMW",
  "Nissan",
  "Volkswagen",
  "Hyundai",
  "Kia",
  "Mazda",
];

// Allows running a subset per invocation (e.g. `npx tsx scripts/seed.ts Ford Chevrolet`) so a
// full run can be split across multiple shorter calls. Defaults to all makes if none given.
const argMakes = process.argv.slice(2);
const SEED_MAKES = argMakes.length > 0 ? argMakes : ALL_SEED_MAKES;

const RESULTS_PER_MAKE = 3; // 10 makes x 3 = ~30 vehicles, matching the Phase 1 target.

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchDataFor(make: string) {
  console.log(`\n=== ${make} ===`);
  const search = await searchVehicles({ make, limit: RESULTS_PER_MAKE });

  for (const summary of search.results) {
    const fetchedAt = new Date();

    // --- Make ---
    // Use `make` (the queried value, consistent casing) rather than `summary.make` — CarVector's
    // casing for this field is inconsistent across results (e.g. "Mazda" vs "MAZDA" within the
    // same search response), which broke the upsert's dedupe-by-name and tripped the slug
    // unique constraint. Confirmed live before fixing, not guessed.
    const makeRow = await prisma.make.upsert({
      where: { name: make },
      create: { name: make, slug: slugify(make) },
      update: {},
    });

    // --- Model ---
    const modelSlug = slugify(`${make}-${summary.model}`);
    const modelRow = await prisma.model.upsert({
      where: { slug: modelSlug },
      create: {
        makeId: makeRow.id,
        name: String(summary.model),
        slug: modelSlug,
        bodyType: typeof summary.body_class === "string" ? summary.body_class : null,
      },
      update: {},
    });

    console.log(`  ${summary.year} ${summary.make} ${summary.model} (${summary.id})`);

    // --- Variant --- (full detail call for fields not in the search summary)
    const detailRes = await fetch(`https://api.carvector.io/v1/vehicles/${summary.id}`, {
      headers: { Authorization: `Bearer ${process.env.CARVECTOR_API_KEY}` },
    });
    if (!detailRes.ok) {
      console.warn(`    skip: detail fetch failed (${detailRes.status})`);
      continue;
    }
    const detail = await detailRes.json();

    // Skip if this exact variant was already inserted by a prior (partial/interrupted) run —
    // makes the script safe to re-run or split across multiple invocations.
    const existingVariant = await prisma.variant.findFirst({
      where: { modelId: modelRow.id, year: detail.year, trimName: detail.trim ?? null },
    });
    if (existingVariant) {
      console.log(`    (variant already seeded, skipping insert)`);
      continue;
    }

    await prisma.variant.create({
      data: {
        modelId: modelRow.id,
        year: detail.year,
        trimName: detail.trim ?? null,
        engineSizeCc: detail.displacement_l ? Math.round(detail.displacement_l * 1000) : null,
        fuelType: detail.fuel_type ?? null,
        transmission: detail.transmission ?? null,
        horsepower: detail.horsepower ?? null,
        doors: detail.doors ?? null,
        // mpg/co2/ved deliberately left null — populated by the VCA/EPA pipeline step.
        dataSource: "CarVector",
        dataFetchedAt: fetchedAt,
      },
    });

    // --- Recalls: CarVector ---
    try {
      const cvRecalls = await getVehicleRecalls(summary.id);
      for (const r of cvRecalls.recalls) {
        const existing = await prisma.recall.findFirst({
          where: { modelId: modelRow.id, nhtsaCampaignId: r.campaign_id, dataSource: "CarVector" },
        });
        if (existing) continue;
        await prisma.recall.create({
          data: {
            modelId: modelRow.id,
            nhtsaCampaignId: r.campaign_id,
            yearFrom: detail.year,
            yearTo: detail.year,
            component: r.component,
            summary: r.summary,
            consequence: r.consequence,
            remedy: r.remedy,
            recallDate: parseCarVectorRecallDate(r.report_received),
            dataSource: "CarVector",
            dataFetchedAt: fetchedAt,
          },
        });
      }
    } catch (err) {
      console.warn(`    CarVector recalls fetch failed for ${summary.id}:`, (err as Error).message);
    }

    // --- Recalls + complaints: NHTSA (per Data-Sources.md: recalls from CarVector + NHTSA,
    // complaints from NHTSA only) ---
    try {
      const nhtsaRecalls = await getRecallsByVehicle({
        make: summary.make,
        model: String(summary.model),
        modelYear: summary.year,
      });
      for (const r of nhtsaRecalls.results) {
        const existing = await prisma.recall.findFirst({
          where: { modelId: modelRow.id, nhtsaCampaignId: r.NHTSACampaignNumber, dataSource: "NHTSA" },
        });
        if (existing) continue;
        await prisma.recall.create({
          data: {
            modelId: modelRow.id,
            nhtsaCampaignId: r.NHTSACampaignNumber,
            yearFrom: Number(r.ModelYear),
            yearTo: Number(r.ModelYear),
            component: r.Component,
            summary: r.Summary,
            consequence: r.Consequence,
            remedy: r.Remedy,
            recallDate: parseNhtsaRecallDate(r.ReportReceivedDate),
            dataSource: "NHTSA",
            dataFetchedAt: fetchedAt,
          },
        });
      }
    } catch (err) {
      console.warn(`    NHTSA recalls fetch failed for ${summary.make} ${summary.model}:`, (err as Error).message);
    }

    try {
      const complaints = await getComplaintsByVehicle({
        make: summary.make,
        model: String(summary.model),
        modelYear: summary.year,
      });
      // Cap per-vehicle complaint rows for a seed run — full ingestion is a later concern.
      for (const c of complaints.results.slice(0, 10)) {
        const existing = await prisma.complaint.findFirst({
          where: { modelId: modelRow.id, variantYear: summary.year, component: c.components, summary: c.summary },
        });
        if (existing) continue;
        await prisma.complaint.create({
          data: {
            modelId: modelRow.id,
            variantYear: summary.year,
            component: c.components,
            summary: c.summary,
            complaintDate: c.dateComplaintFiled ? new Date(c.dateComplaintFiled) : null,
            crashInvolved: c.crash,
            injuryInvolved: c.numberOfInjuries > 0,
            dataSource: "NHTSA",
            dataFetchedAt: fetchedAt,
          },
        });
      }
    } catch (err) {
      console.warn(`    NHTSA complaints fetch failed for ${summary.make} ${summary.model}:`, (err as Error).message);
    }
  }
}

async function main() {
  for (const make of SEED_MAKES) {
    await fetchDataFor(make);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
