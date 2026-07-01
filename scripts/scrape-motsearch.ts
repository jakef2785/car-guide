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

import { Prisma, PrismaClient } from "@prisma/client";
import {
  brandUrl,
  fetchHtml,
  normName,
  parseBrandModels,
  parseModelYearStats,
  parseYearPage,
  type BrandModel,
} from "../lib/data-pipeline/motsearch";

// NOTE on DIRECT_URL: despite the name, .env.local's DIRECT_URL is the Supabase *session* pooler
// (port 5432), not a true unpooled connection — the real direct connection is IPv6-only and
// unreachable from here. A session pooler still idle-closes connections (P1017), and this script
// holds one client open across many minutes of HTTP-bound work between writes, so hitting P1017
// once during a long run is expected, not exceptional. Root-cause fix: treat P1017 as recoverable
// — reconnect and retry the write — rather than letting it crash the whole run. See withDbRetry().
// connection_limit/pool_timeout: this script never issues concurrent queries, so Prisma's
// default pool size (CPU-count-derived, e.g. 17) is pure overkill against a session pooler that
// caps total connections per project — a single idle-but-claimed slot is enough to eventually
// starve the pool (see P2024 handling below). A pool of 2 with a longer acquire timeout is both
// sufficient and much less likely to wedge.
function withPoolParams(url: string | undefined): string | undefined {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=2&pool_timeout=30`;
}
const dbUrl = withPoolParams(process.env.DIRECT_URL ?? process.env.DATABASE_URL);
let prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const SOURCE = "MOT (motsearch)";
const FAULTS = process.argv.includes("--faults");
// Polite gap between requests; gentler for the heavy per-year faults pass. jitter() below adds
// +/-30% randomness so the cadence isn't a perfectly regular bot-like interval.
const DELAY_MS = FAULTS ? 1300 : 700;
// Optional make filter: any non-flag args restrict the run to those makes (e.g. `... Ford Kia`).
const MAKE_FILTER = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (base: number) => sleep(base + Math.round(Math.random() * base * 0.6 - base * 0.3));

// P1017 = "Server has closed the connection" — the pooler dropped an idle connection and said so
// cleanly. P2024 = "Timed out fetching a new connection from the connection pool" — the same idle-
// pooler-connection problem but manifesting as a silently-dead socket instead of a clean close, so
// Prisma's local pool waits the full pool_timeout for a slot that will never free up. Both are
// connection-pool staleness, not real query failures: reconnect (fresh PrismaClient on the same
// URL) and retry a bounded number of times. Any other error is rethrown immediately.
function isConnectionClosed(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P1017" || err.code === "P2024")
  );
}

async function withDbRetry<T>(label: string, fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(prisma);
    } catch (err) {
      if (!isConnectionClosed(err) || attempt === maxAttempts) throw err;
      console.log(
        `  [reconnect] ${label}: stale pooler connection (${err instanceof Prisma.PrismaClientKnownRequestError ? err.code : "?"}), reconnecting (attempt ${attempt}/${maxAttempts})`,
      );
      const stale = prisma;
      prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
      await stale.$disconnect().catch(() => {});
      await sleep(500 * attempt);
    }
  }
  throw new Error("unreachable");
}

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
  const seen = new Set<string>();
  for (const c of ranked) {
    const entries = c.defects.length
      ? c.defects.map((d) => `${c.category}: ${d}`)
      : c.modelPer100 != null
        ? [`${c.category} (${c.modelPer100}/100 tests)`]
        : [];
    for (const e of entries) {
      if (!seen.has(e)) {
        seen.add(e);
        out.push(e);
      }
    }
    if (out.length >= 6) break;
  }
  return out.slice(0, 6);
}

async function main() {
  const models = await withDbRetry("initial model fetch", (client) =>
    client.model.findMany({ select: { id: true, name: true, make: { select: { name: true } } } }),
  );
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
  let yearPageFailures = 0;
  // Circuit breaker: a long unbroken streak of "no response" failures is more likely a block/
  // rate-limit on the remote end than 50 independent outages, and hammering straight through it
  // (as the overnight run did: 48/52 makes "no response" in one pass) is exactly what risks
  // extending or deepening that block. Back off hard after a few in a row instead of plowing on.
  let consecutiveFailures = 0;
  const COOLDOWN_AFTER = 3;
  const COOLDOWN_MS = 90_000;

  for (const [make, catModels] of Array.from(byMake)) {
    if (consecutiveFailures >= COOLDOWN_AFTER) {
      console.log(`  [cooldown] ${consecutiveFailures} consecutive failures — pausing ${COOLDOWN_MS / 1000}s before continuing`);
      await sleep(COOLDOWN_MS);
    }
    const brand = await fetchHtml(brandUrl(make));
    await jitter(DELAY_MS);
    if (!brand.ok) {
      makesMissing++;
      consecutiveFailures++;
      console.log(`  [skip make] ${make} -> ${brand.status || "no response"} at ${brandUrl(make)}`);
      continue;
    }
    consecutiveFailures = 0;
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
      await jitter(DELAY_MS);
      if (!page.ok) continue;
      const years = parseModelYearStats(page.html);
      if (years.length === 0) continue;
      modelsMatched++;

      // Build every row for this model FIRST (the slow per-year HTTP fetches happen with no open DB
      // connection), then write them in one short burst — keeps the DB connection from idling out.
      const rowsForModel = [];
      for (const y of years) {
        let testCount: number | null = null;
        let sampleCars: number | null = null;
        let topFailures: string[] = [];
        let defectsPer100 = y.defectsPer100;
        let yearAvgPer100 = y.yearAvgPer100;

        if (FAULTS) {
          const yp = await fetchHtml(`${url}${y.modelYear}/`);
          await jitter(DELAY_MS);
          yearPages++;
          if (yp.ok) {
            const stats = parseYearPage(yp.html);
            testCount = stats.testCount;
            sampleCars = stats.sampleCars;
            topFailures = buildTopFailures(stats.categories);
            if (stats.modelPer100 != null) defectsPer100 = stats.modelPer100;
            if (stats.yearAvgPer100 != null) yearAvgPer100 = stats.yearAvgPer100;
          } else {
            // Previously silent — a model with many years all failing here looked identical to a
            // hang (no log output for minutes while retries+backoff burned through every year).
            yearPageFailures++;
            console.log(`    [year-page miss] ${make} ${cm.name} ${y.modelYear} -> ${yp.status || "no response"}`);
          }
        }

        rowsForModel.push({
          modelId: cm.id,
          ageBand: y.modelYear,
          defectsPer100,
          yearAvgPer100,
          testCount,
          sampleCars,
          topFailures,
          dataSource: SOURCE,
          dataFetchedAt: fetchedAt,
        });
      }

      // Clean refresh of this source for this model, then bulk insert (one round-trip). Wrapped in
      // withDbRetry: this write follows a burst of slow HTTP fetches (the per-year faults pass can
      // be 10+ requests for one model), so it's exactly the kind of post-idle write that triggers
      // P1017 against a session pooler.
      const res = await withDbRetry(`write ${make} ${cm.name}`, (client) =>
        client.motReliability
          .deleteMany({ where: { modelId: cm.id, dataSource: SOURCE } })
          .then(() => client.motReliability.createMany({ data: rowsForModel })),
      );
      rows += res.count;
      console.log(`  [ok] ${make} ${cm.name} <- ${match.name} (${years.length} years)`);
    }
  }

  console.log(`\nMakes: ${makesHit} hit, ${makesMissing} missing on motsearch.`);
  console.log(`Models: ${modelsMatched} enriched, ${modelsUnmatched} no motsearch match (left empty — not fabricated).`);
  console.log(`Reliability rows written: ${rows}${FAULTS ? ` (with ${yearPages} year pages for faults, ${yearPageFailures} year-page misses)` : " (pass 1 — run with --faults for fault detail)"}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // `prisma` may have been reassigned by withDbRetry's reconnect logic — disconnect whichever
    // client is current.
    await prisma.$disconnect();
  });
