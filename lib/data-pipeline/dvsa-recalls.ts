// DVSA Vehicle Safety Branch recalls parser.
//
// Source: the DVSA "Vehicle Safety Branch Recalls Database" (data.gov.uk, OGL v3.0) —
// historically a single CSV (RecallsFile.csv). NOTE (2026-06-29): the published download URL
// (dft.gov.uk/vosa/apps/recalls/RecallsFile.csv) is dead and the live alternatives are either
// credentialed (SMMT API) or per-vehicle/limited (MOT History API, a few van makes). So, exactly
// as with VCA, the file must be obtained manually and dropped at data/dvsa/RecallsFile.csv; this
// parser is ready for it. See vault decision 0014. No fabricated data: with no file, nothing seeds.
//
// The parser is header-name tolerant (the canonical export's column names have varied over the
// years) — it resolves each field from a set of known aliases and leaves unmatched fields null.
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

export type DvsaRecall = {
  make: string;
  model: string;
  campaignRef: string | null; // e.g. "R/2019/001"
  component: string | null; // short concern / affected component
  summary: string | null; // defect description
  remedy: string | null;
  recallDate: Date | null; // launch date
};

// Case-insensitive header resolution: first alias present in the row wins.
function pick(row: Record<string, string>, aliases: string[]): string | null {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const k = keys.find((key) => key.trim().toLowerCase() === alias.toLowerCase());
    if (k != null) {
      const v = (row[k] ?? "").trim();
      if (v) return v;
    }
  }
  return null;
}

// DVSA launch dates appear as "dd/mm/yyyy" (UK, 4-digit year) or ISO. Returns null on anything
// else — a wrong date is worse than no date. We never hand an ambiguous string to `new Date`:
// a 2-digit-year or bare dd/mm would be parsed in US locale (mm/dd) and silently swap day/month.
export function parseRecallDate(raw: string | null): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const uk = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (uk) {
    const [, d, m, y] = uk;
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    // Reject rolled-over dates (e.g. 31/02 -> 03 Mar) by round-tripping the components.
    if (dt.getUTCFullYear() === Number(y) && dt.getUTCMonth() === Number(m) - 1 && dt.getUTCDate() === Number(d)) {
      return dt;
    }
    return null;
  }
  // Strict ISO yyyy-mm-dd only, validated by round-trip.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const ymd = `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dt = new Date(`${ymd}T00:00:00Z`);
    if (!Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === ymd) return dt;
  }
  return null;
}

export function parseDvsaRecallsCsv(path: string): DvsaRecall[] {
  // The export has historically been Latin-1; read as latin1 like VCA to be safe with symbols.
  const content = readFileSync(path, "latin1");
  const records: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });

  const out: DvsaRecall[] = [];
  for (const r of records) {
    const make = pick(r, ["Make", "Manufacturer", "Marque"]);
    const model = pick(r, ["Model", "Models", "Model(s)"]);
    if (!make || !model) continue; // can't match a recall we can't attribute to a make/model
    const component = pick(r, ["Concern", "Component", "System Affected", "Affected"]);
    // Don't fall back to "Concern" for summary — when the export has only a Concern column it would
    // echo the same string into both fields, presenting one value as two distinct facts.
    let summary = pick(r, ["Defect", "Defect Description", "Description"]);
    if (summary && summary === component) summary = null;
    out.push({
      make,
      model,
      campaignRef: pick(r, ["Recalls Number", "Recall Number", "Reference", "Campaign", "Campaign Number"]),
      component,
      summary,
      remedy: pick(r, ["Remedy", "Rectification", "Corrective Action"]),
      recallDate: parseRecallDate(pick(r, ["Launch Date", "Recall Date", "Date", "Date Launched"])),
    });
  }
  return out;
}

// Normalised key for matching a recall's make/model against the seeded catalogue. Lower-cased,
// punctuation/whitespace collapsed — same spirit as the VCA make/model normalisation.
export function recallMatchKey(make: string, model: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\bMY\d{2,4}\b/gi, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(make)}|${norm(model)}`;
}
