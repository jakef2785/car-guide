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

// DVSA launch dates appear as "dd/mm/yyyy" (UK) or ISO. Returns null on anything unparseable
// rather than guessing — a wrong date is worse than no date.
export function parseRecallDate(raw: string | null): Date | null {
  if (!raw) return null;
  const uk = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (uk) {
    const [, d, m, y] = uk;
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
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
    out.push({
      make,
      model,
      campaignRef: pick(r, ["Recalls Number", "Recall Number", "Reference", "Campaign", "Campaign Number"]),
      component: pick(r, ["Concern", "Component", "System Affected", "Affected"]),
      summary: pick(r, ["Defect", "Defect Description", "Description", "Concern"]),
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
