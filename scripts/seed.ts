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
// SYNC, NOT WIPE: models are upserted by slug and only the variants (which this script wholly
// owns) are rebuilt. Enrichment layered onto models by other scripts — MOT reliability
// (scrape-motsearch.ts) and recalls (match-dvsa-recalls.ts) — survives a re-seed. When a model's
// cleaned name changes (e.g. "HR-V 2023" -> "HR-V"), its enrichment is re-pointed at the renamed
// model before the stale row is pruned. Pass --wipe for the old scorched-earth behaviour (drops
// ALL models and their enrichment first — you will need to re-run the enrichment scripts).
//
// Run with: node --env-file=.env.local --import tsx scripts/seed.ts [--wipe]

import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseVcaCsv, cleanModel, type VcaVariant } from "../lib/data-pipeline/vca";
import { calculateFirstYearVed } from "../lib/data-pipeline/ved";
import { planEnrichmentMoves } from "../lib/data-pipeline/enrichment-migration";

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

  if (process.argv.includes("--wipe")) {
    console.log("--wipe: clearing existing catalogue (cascade delete, enrichment included)...");
    await prisma.make.deleteMany({});
  }

  const fetchedAt = new Date();

  // --- Makes: one row per unique display name, kept across runs (ids are stable). ---
  const makeNames = Array.from(new Set(rows.map((r) => r.make))).sort();
  await prisma.make.createMany({
    data: makeNames.map((name) => ({ name, slug: slugify(name) })),
    skipDuplicates: true,
  });
  const makes = await prisma.make.findMany({ select: { id: true, name: true } });
  const makeIdByName = new Map(makes.map((m) => [m.name, m.id]));
  const makeNameById = new Map(makes.map((m) => [m.id, m.name]));
  console.log(`Catalogue makes: ${makeNames.length}.`);

  // --- Models: one row per unique (make, model), upserted by slug so existing ids (and the
  // enrichment hanging off them) are preserved. Slug is make+model so two makes can share a
  // model name without colliding on the global unique slug. First occurrence wins on collision. ---
  const modelBySlug = new Map<string, { makeId: string; name: string; slug: string }>();
  for (const r of rows) {
    const slug = slugify(`${r.make}-${r.model}`);
    if (modelBySlug.has(slug)) continue;
    const makeId = makeIdByName.get(r.make);
    if (!makeId) continue;
    modelBySlug.set(slug, { makeId, name: r.model, slug });
  }

  const existingModels = await prisma.model.findMany({
    select: { id: true, name: true, slug: true, makeId: true },
  });
  const existingSlugs = new Set(existingModels.map((m) => m.slug));
  const toCreate = Array.from(modelBySlug.values()).filter((m) => !existingSlugs.has(m.slug));
  await prisma.model.createMany({ data: toCreate, skipDuplicates: true });
  const models = await prisma.model.findMany({ select: { id: true, slug: true } });
  const modelIdBySlug = new Map(models.map((m) => [m.slug, m.id]));
  console.log(`Catalogue models: ${modelBySlug.size} (${toCreate.length} new).`);

  // --- Migrate enrichment off stale models before pruning them. A model goes stale when its
  // cleaned name changed (renamed/merged, e.g. "HR-V 2023" -> "HR-V") or VCA dropped it. For a
  // rename we re-point its MOT reliability / recalls at the successor — unless the successor
  // already has that data (three "HR-V <year>" donors carry the same motsearch nameplate data;
  // the richest donor wins, the rest are near-duplicates and die with their stale model).
  // Reliability and recalls are migrated as two INDEPENDENT passes (planEnrichmentMoves per
  // criterion) — sharing one donor ranking would let a model win the recalls migration purely
  // because it had more reliability rows, silently losing a larger recall set to a rival donor
  // with fewer reliability rows but more recalls. See tests/unit/enrichment-migration.test.ts. ---
  const staleModels = existingModels.filter((m) => !modelBySlug.has(m.slug));

  const targetFor = (stale: { name: string; makeId: string | null }): string | null => {
    const makeName = stale.makeId ? makeNameById.get(stale.makeId) : null;
    if (!makeName) return null;
    const targetSlug = slugify(`${makeName}-${cleanModel(stale.name)}`);
    return modelBySlug.has(targetSlug) ? modelIdBySlug.get(targetSlug) ?? null : null;
  };

  async function migrateCriterion(
    label: string,
    countsByModelId: () => Promise<Map<string, number>>,
    alreadyFilled: () => Promise<Set<string>>,
    applyMove: (staleId: string, targetId: string) => Promise<number>
  ): Promise<number> {
    const counts = await countsByModelId();
    const donors = staleModels.map((m) => ({
      staleId: m.id,
      targetId: targetFor(m),
      count: counts.get(m.id) ?? 0,
    }));
    const moves = planEnrichmentMoves(donors, await alreadyFilled());
    let moved = 0;
    for (const { staleId, targetId } of moves) {
      const count = await applyMove(staleId, targetId);
      moved += count;
      const stale = staleModels.find((m) => m.id === staleId)!;
      console.log(`  ${label}: "${stale.name}" -> target model (${count} rows)`);
    }
    return moved;
  }

  const distinctModelIds = async (
    findMany: (args: { distinct: ["modelId"]; select: { modelId: true } }) => Promise<{ modelId: string | null }[]>
  ): Promise<Set<string>> =>
    new Set(
      (await findMany({ distinct: ["modelId"], select: { modelId: true } }))
        .map((r) => r.modelId)
        .filter((id): id is string => id !== null)
    );

  const movedRel = await migrateCriterion(
    "reliability",
    async () => {
      const groups = await prisma.motReliability.groupBy({ by: ["modelId"], _count: { _all: true } });
      return new Map(groups.filter((g) => g.modelId).map((g) => [g.modelId as string, g._count._all]));
    },
    () => distinctModelIds(prisma.motReliability.findMany.bind(prisma.motReliability)),
    async (staleId, targetId) => {
      const res = await prisma.motReliability.updateMany({ where: { modelId: staleId }, data: { modelId: targetId } });
      return res.count;
    }
  );
  const movedRecalls = await migrateCriterion(
    "recalls",
    async () => {
      const groups = await prisma.recall.groupBy({ by: ["modelId"], _count: { _all: true } });
      return new Map(groups.filter((g) => g.modelId).map((g) => [g.modelId as string, g._count._all]));
    },
    () => distinctModelIds(prisma.recall.findMany.bind(prisma.recall)),
    async (staleId, targetId) => {
      const res = await prisma.recall.updateMany({ where: { modelId: staleId }, data: { modelId: targetId } });
      return res.count;
    }
  );

  // --- Prune models VCA no longer lists (their remaining rows cascade), then empty makes. ---
  if (staleModels.length > 0) {
    await prisma.model.deleteMany({ where: { id: { in: staleModels.map((m) => m.id) } } });
  }
  const prunedMakes = await prisma.make.deleteMany({ where: { models: { none: {} } } });
  console.log(
    `Pruned ${staleModels.length} stale models, ${prunedMakes.count} empty makes; ` +
      `migrated ${movedRel} reliability rows, ${movedRecalls} recalls.`
  );

  // --- Variants: wholly owned by this script — rebuilt from scratch every run. Missing -> null,
  // never faked. ---
  await prisma.variant.deleteMany({});
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
        powertrain: r.powertrain,
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

  // Final identity guard at the DB boundary: the parser dedupes per cleaned model NAME, but two
  // names can still land on one model row via slug collision (slugify folds case AND punctuation,
  // e.g. "ID.7" vs "ID 7"). One row per (model page, trim, engine, fuel, gearbox, power) — that
  // tuple is exactly what the variant picker shows.
  const seenIdentity = new Set<string>();
  const uniqueVariants = variantData.filter((v) => {
    const key = [v.modelId, v.trimName, v.engineSizeCc, v.fuelType, v.transmission, v.horsepower]
      .join("|")
      .toLowerCase();
    if (seenIdentity.has(key)) return false;
    seenIdentity.add(key);
    return true;
  });
  if (uniqueVariants.length < variantData.length) {
    console.log(`Dropped ${variantData.length - uniqueVariants.length} slug-collision duplicate variants.`);
  }

  // createMany in chunks — a single 5k-row insert can exceed the pooled connection's limits.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < uniqueVariants.length; i += CHUNK) {
    const batch = uniqueVariants.slice(i, i + CHUNK);
    const res = await prisma.variant.createMany({ data: batch });
    inserted += res.count;
  }
  console.log(`Inserted ${inserted} variants.`);

  // --- Coverage report: make data gaps visible rather than silently swallowed. ---
  const withMpg = uniqueVariants.filter((v) => v.mpgCombined !== null).length;
  const withCo2 = uniqueVariants.filter((v) => v.co2Gkm !== null).length;
  const withHp = uniqueVariants.filter((v) => v.horsepower !== null).length;
  const withEngine = uniqueVariants.filter((v) => v.engineSizeCc !== null).length;
  const pct = (n: number) => `${((n / uniqueVariants.length) * 100).toFixed(0)}%`;
  console.log("\nField coverage (rest left null — not fabricated):");
  console.log(`  MPG (combined): ${withMpg}/${uniqueVariants.length} (${pct(withMpg)})`);
  console.log(`  CO2:            ${withCo2}/${uniqueVariants.length} (${pct(withCo2)})`);
  console.log(`  Horsepower:     ${withHp}/${uniqueVariants.length} (${pct(withHp)})`);
  console.log(`  Engine size:    ${withEngine}/${uniqueVariants.length} (${pct(withEngine)})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
