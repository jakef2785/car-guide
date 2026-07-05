// Phase 2.5 — aggregate DVSA Anonymised MOT data into a per-model reliability signal.
//
// Streams data/dvsa/mot_results.csv (obtain manually — these files are multi-GB; see
// lib/data-pipeline/dvsa-mot.ts and vault decision 0015), aggregates pass rate + top failure
// categories per make+model, matches to seeded models and writes MotReliability rows
// (dataSource "DVSA MOT"). Re-running replaces this source's rows for a clean refresh.
//
// Run AFTER scripts/seed.ts, with:
//   node --env-file=.env.local --import tsx scripts/match-dvsa-mot.ts
//
// No fabricated data: if the file is missing, the script exits cleanly having changed nothing.

import { existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { aggregateMotFile } from "../lib/data-pipeline/dvsa-mot";
import { recallMatchKey } from "../lib/data-pipeline/dvsa-recalls"; // shared make+model normaliser

const prisma = new PrismaClient();
const CSV_PATH = path.join(__dirname, "..", "data", "dvsa", "mot_results.csv");

// Models with very few tests give a noisy pass rate — require a floor before publishing a signal.
const MIN_TESTS = 100;

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.log(
      `No DVSA MOT file at ${CSV_PATH}.\n` +
        `These datasets are multi-GB and must be obtained manually (see vault decision 0015).\n` +
        `Nothing changed — reliability left unseeded rather than fabricated.`,
    );
    return;
  }

  console.log("Streaming + aggregating MOT data (this can take a while for a full-year file)...");
  const aggregates = await aggregateMotFile(CSV_PATH, { minTests: MIN_TESTS, topN: 5 });
  console.log(`Aggregated ${aggregates.length} make/model groups (>= ${MIN_TESTS} tests).`);

  const models = await prisma.model.findMany({ select: { id: true, name: true, make: { select: { name: true } } } });
  const modelIdByKey = new Map<string, string>();
  for (const m of models) {
    if (!m.make) continue;
    modelIdByKey.set(recallMatchKey(m.make.name, m.name), m.id);
  }

  // Clean refresh of this source.
  await prisma.motReliability.deleteMany({ where: { dataSource: "DVSA MOT" } });

  const fetchedAt = new Date();
  let written = 0;
  let unmatched = 0;
  for (const a of aggregates) {
    const modelId = modelIdByKey.get(recallMatchKey(a.make, a.model));
    if (!modelId) {
      unmatched++;
      continue;
    }
    await prisma.motReliability.create({
      data: {
        modelId,
        ageBand: null, // all ages — per-age-band granularity is a later refinement
        testCount: a.testCount,
        passRate: a.passRate,
        topFailures: a.topFailures,
        dataSource: "DVSA MOT",
        dataFetchedAt: fetchedAt,
      },
    });
    written++;
  }

  console.log(`\nWrote ${written} reliability rows.`);
  console.log(`${unmatched} aggregates had no matching catalogue model (skipped — not fabricated).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
