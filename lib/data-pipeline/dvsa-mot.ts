// DVSA Anonymised MOT data — reliability signal aggregator.
//
// Source: DVSA "Anonymised MOT tests and results" (open.data.dvsa.gov.uk, OGL). Annual result
// files are very large (multiple GB), so aggregation is STREAMED — rows are folded into running
// per-(make,model) tallies and never all held in memory. Obtain a result file manually and point
// the script at it (see scripts/match-dvsa-mot.ts and vault decision 0015); this module is ready.
//
// The reliability signal is the initial-MOT pass rate per model plus its most common failure
// categories. test_result codes: P / PRS (pass at station) count as passes; F is a fail; abandoned
// codes (ABA/ABR) are excluded from the rate. Failure categories come from a failure-reason column
// when the file carries one; otherwise topFailures is left empty (the rate alone is still a signal).
//
// No fabricated data: a model with no MOT rows simply gets no reliability row.

import { createReadStream } from "fs";
import { createInterface } from "readline";

export type MotAggregate = {
  make: string;
  model: string;
  testCount: number;
  passRate: number; // percent, 0-100, two decimals
  topFailures: string[]; // failure categories, most common first
};

const PASS_CODES = new Set(["P", "PRS"]);
const FAIL_CODES = new Set(["F"]);

// Resolve a column index by trying known header aliases (case-insensitive).
function indexOfHeader(header: string[], aliases: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const i = lower.indexOf(a.toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
}

type Tally = { tests: number; passes: number; failures: Map<string, number> };

// Pure, streamable aggregator: feed it the header then each row's already-split columns. Holds
// only per-(make,model) tallies, not rows — safe for arbitrarily large inputs.
export class MotAggregator {
  private byKey = new Map<string, { make: string; model: string; tally: Tally }>();
  private iMake = -1;
  private iModel = -1;
  private iResult = -1;
  private iFailure = -1;

  setHeader(header: string[]) {
    this.iMake = indexOfHeader(header, ["make", "manufacturer"]);
    this.iModel = indexOfHeader(header, ["model"]);
    this.iResult = indexOfHeader(header, ["test_result", "result", "testresult"]);
    this.iFailure = indexOfHeader(header, ["failure_category", "rfr_type", "rfr", "failure_reason", "fail_category"]);
  }

  addRow(cols: string[]) {
    if (this.iMake < 0 || this.iModel < 0 || this.iResult < 0) return;
    const make = (cols[this.iMake] ?? "").trim();
    const model = (cols[this.iModel] ?? "").trim();
    const result = (cols[this.iResult] ?? "").trim().toUpperCase();
    if (!make || !model) return;
    const isPass = PASS_CODES.has(result);
    const isFail = FAIL_CODES.has(result);
    if (!isPass && !isFail) return; // ignore abandoned/other so the rate stays meaningful

    const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
    let entry = this.byKey.get(key);
    if (!entry) {
      entry = { make, model, tally: { tests: 0, passes: 0, failures: new Map() } };
      this.byKey.set(key, entry);
    }
    entry.tally.tests++;
    if (isPass) entry.tally.passes++;
    if (isFail && this.iFailure >= 0) {
      const cat = (cols[this.iFailure] ?? "").trim();
      if (cat) entry.tally.failures.set(cat, (entry.tally.failures.get(cat) ?? 0) + 1);
    }
  }

  // Emit aggregates, optionally dropping models with too few tests to be a reliable signal.
  results(minTests = 1, topN = 5): MotAggregate[] {
    const out: MotAggregate[] = [];
    this.byKey.forEach(({ make, model, tally }) => {
      if (tally.tests < minTests) return;
      const failEntries: Array<[string, number]> = [];
      tally.failures.forEach((count, cat) => failEntries.push([cat, count]));
      const topFailures = failEntries
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([cat]) => cat);
      out.push({
        make,
        model,
        testCount: tally.tests,
        passRate: Math.round((tally.passes / tally.tests) * 10000) / 100,
        topFailures,
      });
    });
    return out;
  }
}

// Split a CSV line on commas. The MOT files are simple comma/pipe-delimited with no quoted commas
// in the columns we read (make/model/result), so a full CSV parser isn't needed and a plain split
// keeps the stream fast. Delimiter is auto-detected from the header (comma or pipe).
function splitLine(line: string, delim: string): string[] {
  return line.split(delim);
}

export async function aggregateMotFile(path: string, opts: { minTests?: number; topN?: number } = {}): Promise<MotAggregate[]> {
  const agg = new MotAggregator();
  const rl = createInterface({ input: createReadStream(path, { encoding: "latin1" }), crlfDelay: Infinity });
  let isHeader = true;
  let delim = ",";
  for await (const line of rl) {
    if (!line) continue;
    if (isHeader) {
      delim = line.includes("|") && !line.includes(",") ? "|" : ",";
      agg.setHeader(splitLine(line, delim));
      isHeader = false;
      continue;
    }
    agg.addRow(splitLine(line, delim));
  }
  return agg.results(opts.minTests ?? 1, opts.topN ?? 5);
}
