// Phase 2.5 — ingest DVSA Vehicle Safety Branch recalls and attach them to seeded UK models.
//
// Reads data/dvsa/RecallsFile.csv (obtain manually — see lib/data-pipeline/dvsa-recalls.ts and
// vault decision 0014), matches each recall to a seeded model by normalised make+model, and
// inserts Recall rows with dataSource "DVSA". Unmatched recalls are reported, not invented.
//
// Run AFTER scripts/seed.ts, with:
//   node --env-file=.env.local --import tsx scripts/match-dvsa-recalls.ts
//
// No fabricated data: if the CSV is missing, the script exits cleanly having changed nothing.

import { existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseDvsaRecallsCsv, recallMatchKey } from "../lib/data-pipeline/dvsa-recalls";

const prisma = new PrismaClient();
const CSV_PATH = path.join(__dirname, "..", "data", "dvsa", "RecallsFile.csv");

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.log(
      `No DVSA recalls file at ${CSV_PATH}.\n` +
        `The published bulk URL is dead; obtain the file manually (see vault decision 0014).\n` +
        `Nothing changed — recalls left unseeded rather than fabricated.`,
    );
    return;
  }

  const recalls = parseDvsaRecallsCsv(CSV_PATH);
  console.log(`Parsed ${recalls.length} DVSA recalls.`);

  // Build a match index from the seeded catalogue: normalised make+model -> modelId.
  const models = await prisma.model.findMany({ select: { id: true, name: true, make: { select: { name: true } } } });
  const modelIdByKey = new Map<string, string>();
  for (const m of models) {
    if (!m.make) continue;
    modelIdByKey.set(recallMatchKey(m.make.name, m.name), m.id);
  }

  const fetchedAt = new Date();
  let matched = 0;
  let unmatched = 0;

  for (const rec of recalls) {
    const modelId = modelIdByKey.get(recallMatchKey(rec.make, rec.model));
    if (!modelId) {
      unmatched++;
      continue;
    }
    // Skip exact duplicates so the script is safe to re-run. When there's no campaign reference,
    // don't treat "both null-ref" as the same recall — distinguish on component+summary so two
    // genuinely different ref-less recalls on one model aren't merged.
    const existing = await prisma.recall.findFirst({
      where: rec.campaignRef
        ? { modelId, campaignRef: rec.campaignRef, dataSource: "DVSA" }
        : { modelId, campaignRef: null, component: rec.component, summary: rec.summary, dataSource: "DVSA" },
    });
    if (existing) continue;

    await prisma.recall.create({
      data: {
        modelId,
        campaignRef: rec.campaignRef,
        component: rec.component,
        summary: rec.summary,
        remedy: rec.remedy,
        recallDate: rec.recallDate,
        dataSource: "DVSA",
        dataFetchedAt: fetchedAt,
      },
    });
    matched++;
  }

  console.log(`\nMatched ${matched} recalls to seeded models.`);
  console.log(`${unmatched} recalls had no matching model in the catalogue (not attached — not fabricated).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
