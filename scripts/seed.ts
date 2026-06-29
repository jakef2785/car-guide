// Phase 2.5 UK seed — builds the entire UK-market catalogue from the VCA carfueldata CSV.
//
// This REPLACES the Phase 1 US seed (CarVector + EPA + NHTSA). The VCA "latest data" CSV is both
// our catalogue (every make/model/trim VCA lists) AND our official UK fuel economy / CO2 source,
// so one pass populates makes, models and variants with WLTP MPG, CO2 and computed VED.
//
// "Every car" by design: we ingest the whole CSV, not a hand-picked subset. Where VCA does not
// carry a value (e.g. an EV has no MPG, a variant lists no power) the field is left null and the
// UI renders "No data available" — we never fabricate a placeholder number (Guiding-Principles.md
// "no fabricated data"). VCA has no per-row model year, so every variant is stamped with a single
// snapshot year (the current on-sale set) — see SNAPSHOT_YEAR below.
//
// Recalls (DVSA) and MOT reliability (DVSA MOT) are layered on afterwards by their own scripts
// (match-dvsa-recalls.ts, match-dvsa-mot.ts) — this script only owns catalogue + VCA economy.
//
// Run with: node --env-file=.env.local --import tsx scripts/seed.ts

import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseVcaCsv, type VcaVariant } from "../lib/data-pipeline/vca";
import { calculateFirstYearVed } from "../lib/data-pipeline/ved";

const prisma = new PrismaClient();

// VCA publishes the current on-sale set with no per-row model year. We stamp a single snapshot
// year for the whole catalogue — these are the 2026 on-sale models. Documented, not fabricated:
// it's a labelled snapshot, and the source tag carries the fetch date for provenance.
const SNAPSHOT_YEAR = 2026;

const CSV_PATH = path.join(__dirname, "..", "data", "vca", "euro6_latest.csv");

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  console.log(`Parsing VCA CSV: ${CSV_PATH}`);
  const rows: VcaVariant[] = parseVcaCsv(CSV_PATH);
  console.log(`Parsed ${rows.length} unique variants from VCA.`);

  // --- Wipe the old (US placeholder) catalogue. Deleting makes cascades to models and their
  // variants/recalls/complaints/tsbs/mot rows via the schema's onDelete: Cascade. "Replace, not
  // augment" — see Phase-2.5-UK-Data-Migration.md. ---
  console.log("Clearing existing catalogue (cascade delete)...");
  await prisma.make.deleteMany({});

  const fetchedAt = new Date();

  // --- Makes: one row per unique display name. ---
  const makeNames = Array.from(new Set(rows.map((r) => r.make))).sort();
  await prisma.make.createMany({
    data: makeNames.map((name) => ({ name, slug: slugify(name) })),
    skipDuplicates: true,
  });
  const makes = await prisma.make.findMany({ select: { id: true, name: true } });
  const makeIdByName = new Map(makes.map((m) => [m.name, m.id]));
  console.log(`Inserted ${makes.length} makes.`);

  // --- Models: one row per unique (make, model). Slug is make+model so two makes can share a
  // model name without colliding on the global unique slug. First occurrence wins on collision. ---
  const modelBySlug = new Map<string, { makeId: string; name: string; slug: string }>();
  for (const r of rows) {
    const slug = slugify(`${r.make}-${r.model}`);
    if (modelBySlug.has(slug)) continue;
    const makeId = makeIdByName.get(r.make);
    if (!makeId) continue;
    modelBySlug.set(slug, { makeId, name: r.model, slug });
  }
  await prisma.model.createMany({ data: Array.from(modelBySlug.values()), skipDuplicates: true });
  const models = await prisma.model.findMany({ select: { id: true, slug: true } });
  const modelIdBySlug = new Map(models.map((m) => [m.slug, m.id]));
  console.log(`Inserted ${models.length} models.`);

  // --- Variants: every CSV row, with VCA economy + computed VED. Missing -> null, never faked. ---
  const variantData = rows.flatMap((r) => {
    const modelId = modelIdBySlug.get(slugify(`${r.make}-${r.model}`));
    if (!modelId) return [];
    const ved = calculateFirstYearVed(r.co2Gkm, r.fuelType);
    return [
      {
        modelId,
        year: SNAPSHOT_YEAR,
        trimName: r.trim,
        engineSizeCc: r.engineSizeCc,
        fuelType: r.fuelType,
        transmission: r.transmission,
        horsepower: r.horsepower,
        mpgUrban: r.mpgUrban,
        mpgExtraUrban: r.mpgExtraUrban,
        mpgCombined: r.mpgCombined,
        co2Gkm: r.co2Gkm,
        // VED is meaningful only where we have CO2 (its input). EV co2=0 -> the £10 band.
        vedAnnualGbp: r.co2Gkm !== null ? ved.firstYearRateGbp : null,
        dataSource: "VCA",
        dataFetchedAt: fetchedAt,
      },
    ];
  });

  // createMany in chunks — a single 5k-row insert can exceed the pooled connection's limits.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < variantData.length; i += CHUNK) {
    const batch = variantData.slice(i, i + CHUNK);
    const res = await prisma.variant.createMany({ data: batch });
    inserted += res.count;
  }
  console.log(`Inserted ${inserted} variants.`);

  // --- Coverage report: make data gaps visible rather than silently swallowed. ---
  const withMpg = variantData.filter((v) => v.mpgCombined !== null).length;
  const withCo2 = variantData.filter((v) => v.co2Gkm !== null).length;
  const withHp = variantData.filter((v) => v.horsepower !== null).length;
  const withEngine = variantData.filter((v) => v.engineSizeCc !== null).length;
  const pct = (n: number) => `${((n / variantData.length) * 100).toFixed(0)}%`;
  console.log("\nField coverage (rest left null — not fabricated):");
  console.log(`  MPG (combined): ${withMpg}/${variantData.length} (${pct(withMpg)})`);
  console.log(`  CO2:            ${withCo2}/${variantData.length} (${pct(withCo2)})`);
  console.log(`  Horsepower:     ${withHp}/${variantData.length} (${pct(withHp)})`);
  console.log(`  Engine size:    ${withEngine}/${variantData.length} (${pct(withEngine)})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
