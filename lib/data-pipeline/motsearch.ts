// motsearch.co.uk MOT-statistics scraper — UK reliability signal by model and model year.
//
// motsearch publishes DVSA "Anonymised MOT" data (OGL / Crown copyright) as per-model and per-
// model-year stats: faults per 100 tests vs the same-year all-cars average, plus per-category
// common faults. We scrape only the models already in our catalogue (enrich, don't expand) and
// politely (rate-limited by the calling script). robots.txt allows all paths.
//
// Provenance: the underlying data is DVSA MOT (OGL); motsearch is the immediate source/aggregator
// — recorded as dataSource "MOT (motsearch)" so the label is honest about both. No fabricated data:
// only values present on the page are stored; anything absent is left null.
//
// Pure parsers (take HTML strings) + a polite fetch helper. The orchestration/rate-limiting and DB
// writes live in scripts/scrape-motsearch.ts.

const BASE = "https://www.motsearch.co.uk/stats";
const UA = "CarGuideBot/1.0 (+personal research; respects robots.txt)";

// --- URL slugs ---------------------------------------------------------------
// motsearch slugs are lower-case with spaces -> underscores (e.g. "Alfa Romeo" -> "alfa_romeo",
// "124 Spider" -> "124_spider"). We don't trust a guessed slug blindly — the scraper resolves the
// real model slug from the brand page where possible and only falls back to this.
export function motsearchSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_+-]/g, "");
}

export function brandUrl(make: string): string {
  return `${BASE}/${motsearchSlug(make)}/`;
}

// Normalised key for matching our catalogue model names to motsearch's (case/punct/MY-insensitive).
export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bMY\d{2,4}\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// --- Parsers -----------------------------------------------------------------

export type BrandModel = { slug: string; name: string };

// Extract {slug, display name} for each model linked from a brand page.
export function parseBrandModels(html: string, make: string): BrandModel[] {
  const brand = motsearchSlug(make);
  const re = new RegExp(
    `<a\\b[^>]*href="https://www\\.motsearch\\.co\\.uk/stats/${brand}/([a-z0-9_+-]+)/"[^>]*>([\\s\\S]*?)</a>`,
    "gi",
  );
  const out = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = m[1];
    const name = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (slug && name && !out.has(slug)) out.set(slug, name);
  }
  return Array.from(out, ([slug, name]) => ({ slug, name }));
}

export type ModelYearStat = {
  modelYear: string;
  defectsPer100: number;
  yearAvgPer100: number;
};

// Model page embeds: const rawData = [{"model_year":"2015","model_avg":"215.00","year_avg":"174.00"},...];
export function parseModelYearStats(html: string): ModelYearStat[] {
  const m = html.match(/const\s+rawData\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return [];
  let rows: Array<{ model_year?: string; model_avg?: string; year_avg?: string }>;
  try {
    rows = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const out: ModelYearStat[] = [];
  for (const r of rows) {
    const yr = (r.model_year ?? "").trim();
    const mv = Number(r.model_avg);
    const yv = Number(r.year_avg);
    if (!yr || !Number.isFinite(mv) || !Number.isFinite(yv)) continue;
    out.push({ modelYear: yr, defectsPer100: mv, yearAvgPer100: yv });
  }
  return out;
}

export type CategoryFault = {
  category: string;
  modelPer100: number | null;
  yearAvgPer100: number | null;
  deltaPct: number | null; // signed: positive = worse than average, negative = better
  defects: string[]; // specific defect descriptions
};

export type YearPageStats = {
  sampleCars: number | null;
  testCount: number | null;
  recordedFaults: number | null;
  modelPer100: number | null;
  yearAvgPer100: number | null;
  categories: CategoryFault[];
};

function num(s: string | undefined | null): number | null {
  if (s == null) return null;
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

// Decode the common HTML entities that appear in motsearch's fault text (e.g. "Wheels &amp; Suspension").
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Year page: sample size line, headline faults/100, and the "card cat-card" category blocks.
export function parseYearPage(html: string): YearPageStats {
  const sample = html.match(/Sample size:\s*([\d,]+)\s*cars,\s*([\d,]+)\s*tests\s*and\s*([\d,]+)\s*recorded faults/i);
  const headline = html.match(/([\d.]+)\s*faults per 100 tests/i);
  const yearAvg = html.match(/Year average for all cars of[^0-9]*\d{4}\s*is\s*([\d.]+)\s*faults per 100 tests/i);

  const categories: CategoryFault[] = [];
  // Isolate the categories section to avoid matching unrelated cards, then split per category card.
  const catStart = html.search(/>\s*Categories\s*</i);
  const catSection = catStart >= 0 ? html.slice(catStart) : html;
  const chunks = catSection.split(/card cat-card/).slice(1);
  for (const chunk of chunks) {
    const nameRaw = chunk.match(/class="fw-semibold">([^<]+)</)?.[1]?.trim();
    if (!nameRaw) continue;
    const name = decodeEntities(nameRaw);
    const delta = chunk.match(/(▲|▼)\s*([\d.]+)%\s*(better|worse)/);
    const modelPer100 = num(chunk.match(/([\d.]+)\s*<span[^>]*>\s*faults \/ 100 tests/i)?.[1]);
    const yAvg = num(chunk.match(/Year avg:\s*([\d.]+)\s*\/ 100 tests/i)?.[1]);
    const defects: string[] = [];
    const ul = chunk.match(/<ul class="bullets[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? "";
    for (const li of Array.from(ul.matchAll(/<li>([\s\S]*?)<\/li>/gi))) {
      const d = decodeEntities(li[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
      if (d) defects.push(d);
    }
    let deltaPct: number | null = null;
    if (delta) {
      const mag = Number(delta[2]);
      deltaPct = delta[3].toLowerCase() === "worse" ? mag : -mag;
    }
    categories.push({ category: name, modelPer100, yearAvgPer100: yAvg, deltaPct, defects });
  }

  return {
    sampleCars: num(sample?.[1]),
    testCount: num(sample?.[2]),
    recordedFaults: num(sample?.[3]),
    modelPer100: num(headline?.[1]),
    yearAvgPer100: num(yearAvg?.[1]),
    categories,
  };
}

// AbortController.abort() asks fetch/undici to cancel — but if the remote end stops sending
// bytes mid-response without closing the socket, abort doesn't always reliably unblock the
// awaited promise (an undici/Node edge case). Race against a hard wall-clock timeout too, so a
// single bad connection can never stall the whole run past timeoutMs+buffer, abort or no abort.
function withHardTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`hard-timeout: ${label}`)), ms);
  });
  return Promise.race([p, guard]).finally(() => clearTimeout(timer)) as Promise<T>;
}

// --- Polite fetch with exponential backoff -----------------------------------
// Retries transient failures (network error / 429 / 5xx) with 2s,4s,8s backoff so a brief
// rate-limit doesn't abandon a whole make. 404 and other 4xx are final (no retry).
export async function fetchHtml(
  url: string,
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<{ ok: boolean; status: number; html: string }> {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const retries = opts.retries ?? 3;
  let last = { ok: false, status: 0, html: "" };
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await withHardTimeout(
        fetch(url, {
          headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-GB,en;q=0.9" },
          signal: ctrl.signal,
        }),
        timeoutMs + 5000,
        "fetch",
      );
      const html = await withHardTimeout(res.text(), timeoutMs + 5000, "body read");
      last = { ok: res.ok, status: res.status, html };
      if (res.ok || (res.status !== 429 && res.status < 500)) return last; // final
    } catch {
      last = { ok: false, status: 0, html: "" };
    } finally {
      clearTimeout(t);
    }
  }
  return last;
}
