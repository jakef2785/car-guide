// Phase 2.5b — scrape motsearch.co.uk MOT reliability and attach it to existing catalogue models.
//
// Pass 1 (default): one model page per matched model -> per-model-year faults-per-100-tests vs the
//   same-year average. Fast (~one request per matched model).
// Pass 2 (--faults): also fetch each model-year page -> test counts + most-common-fault categories,
//   updating the rows from pass 1. Heavy (one request per model-year) — run overnight.
//
// Enrich-existing-only: we never add models; we only attach reliability to models already seeded
// from VCA. No fabricated data: only values present on the page are stored. Polite: rate-limited.
//
// Run:  node --env-file=.env.local --import tsx scripts/scrape-motsearch.ts            (pass 1)
//       node --env-file=.env.local --import tsx scripts/scrape-motsearch.ts --faults   (pass 2)

import { PrismaClient } from "@prisma/client";
import {
  brandUrl,
  fetchHtml,
  normName,
  parseBrandModels,
  parseModelYearStats,
  parseYearPage,
  type BrandModel,
} from "../lib/data-pipeline/motsearch";

const prisma = new PrismaClient();
const SOURCE = "MOT (motsearch)";
const FAULTS = process.argv.includes("--faults");
// Polite gap between requests; gentler for the heavy per-year faults pass.
const DELAY_MS = FAULTS ? 1300 : 700;
// Optional make filter: any non-flag args restrict the run to those makes (e.g. `... Ford Kia`).
const MAKE_FILTER = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Match a (messy) catalogue model name to a motsearch model. Catalogue names carry VCA cruft
// (e.g. "New Focus Model Year Post 2024.00"), so beyond exact/prefix we also accept whole-word
// containment of the motsearch nameplate within the catalogue name ("focus" in "new focus ..."),
// guarded against trivially-short tokens. Returns the best (most-specific) match or null.
function matchModel(catalogueName: string, candidates: BrandModel[]): BrandModel | null {
  const target = normName(catalogueName);
  if (!target) return null;
  const targetWords = new Set(target.split(" "));
  let best: { c: BrandModel; score: number } | null = null;
  for (const c of candidates) {
    const cand = normName(c.name);
    if (!cand) continue;
    const candWords = cand.split(" ");
    let score = 0;
    if (cand === target) score = 100;
    else if (target.startsWith(cand + " ")) score = 50 + cand.length;
    else if (cand.startsWith(target + " ")) score = 50 + target.length;
    // Whole-word containment: every motsearch word appears in the catalogue name, and at least
    // one is >= 3 chars (so "ka"/"id" don't match spuriously). Lower score than prefix/exact.
    else if (candWords.every((w) => targetWords.has(w)) && candWords.some((w) => w.length >= 3)) {
      score = cand.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { c, score };
  }
  return best?.c ?? null;
}

function buildTopFailures(cats: ReturnType<typeof parseYearPage>["categories"]): string[] {
  // Most-common-fault descriptions, ordered by the model's faults/100 across categories.
  const ranked = [...cats].sort((a, b) => (b.modelPer100 ?? 0) - (a.modelPer100 ?? 0));
  const out: string[] = [];
  for (const c of ranked) {
    if (c.defects.length) out.push(...c.defects.map((d) => `${c.category}: ${d}`));
    else if (c.modelPer100 != null) out.push(`${c.category} (${c.modelPer100}/100 tests)`);
    if (out.length >= 6) break;
  }
  return out.slice(0, 6);
}

async function main() {
  const models = await prisma.model.findMany({
    select: { id: true, name: true, make: { select: { name: true } } },
  });
  // Group catalogue models by make.
  const byMake = new Map<string, { id: string; name: string }[]>();
  for (const m of models) {
    if (!m.make) continue;
    if (MAKE_FILTER.length && !MAKE_FILTER.some((f) => f.toLowerCase() === m.make!.name.toLowerCase())) continue;
    const arr = byMake.get(m.make.name) ?? [];
    arr.push({ id: m.id, name: m.name });
    byMake.set(m.make.name, arr);
  }

  const fetchedAt = new Date();
  let makesHit = 0, makesMissing = 0, modelsMatched = 0, modelsUnmatched = 0, rows = 0, yearPages = 0;

  for (const [make, catModels] of Array.from(byMake)) {
    const brand = await fetchHtml(brandUrl(make));
    await sleep(DELAY_MS);
    if (!brand.ok) {
      makesMissing++;
      console.log(`  [skip make] ${make} -> ${brand.status || "no response"} at ${brandUrl(make)}`);
      continue;
    }
    makesHit++;
    const candidates = parseBrandModels(brand.html, make);

    for (const cm of catModels) {
      const match = matchModel(cm.name, candidates);
      if (!match) {
        modelsUnmatched++;
        continue;
      }
      const url = `https://www.motsearch.co.uk/stats/${normName(make).replace(/ /g, "_")}/${match.slug}/`;
      const page = await fetchHtml(url);
      await sleep(DELAY_MS);
      if (!page.ok) continue;
      const years = parseModelYearStats(page.html);
      if (years.length === 0) continue;
      modelsMatched++;

      // Clean refresh of this source for this model.
      await prisma.motReliability.deleteMany({ where: { modelId: cm.id, dataSource: SOURCE } });

      for (const y of years) {
        let testCount: number | null = null;
        let sampleCars: number | null = null;
        let topFailures: string[] = [];
        let defectsPer100 = y.defectsPer100;
        let yearAvgPer100 = y.yearAvgPer100;

        if (FAULTS) {
          const yp = await fetchHtml(`${url}${y.modelYear}/`);
          await sleep(DELAY_MS);
          yearPages++;
          if (yp.ok) {
            const stats = parseYearPage(yp.html);
            testCount = stats.testCount;
            sampleCars = stats.sampleCars;
            topFailures = buildTopFailures(stats.categories);
            if (stats.modelPer100 != null) defectsPer100 = stats.modelPer100;
            if (stats.yearAvgPer100 != null) yearAvgPer100 = stats.yearAvgPer100;
          }
        }

        await prisma.motReliability.create({
          data: {
            modelId: cm.id,
            ageBand: y.modelYear,
            defectsPer100,
            yearAvgPer100,
            testCount,
            sampleCars,
            topFailures,
            dataSource: SOURCE,
            dataFetchedAt: fetchedAt,
          },
        });
        rows++;
      }
      console.log(`  [ok] ${make} ${cm.name} <- ${match.name} (${years.length} years)`);
    }
  }

  console.log(`\nMakes: ${makesHit} hit, ${makesMissing} missing on motsearch.`);
  console.log(`Models: ${modelsMatched} enriched, ${modelsUnmatched} no motsearch match (left empty — not fabricated).`);
  console.log(`Reliability rows written: ${rows}${FAULTS ? ` (with ${yearPages} year pages for faults)` : " (pass 1 — run with --faults for fault detail)"}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
