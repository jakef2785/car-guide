// VCA carfueldata WLTP parser — UK official fuel economy / CO2 + a UK-market catalogue.
// Source: https://carfueldata.vehicle-certification-agency.gov.uk/ "Download latest data" (CSV).
// The file is Windows-1252/Latin-1 encoded (e.g. é = 0xE9), so we read it as latin1, not utf-8.
// VCA has no per-row model year (it's the current on-sale set) — callers stamp a snapshot year.
// Specs VCA does not carry (0-60, torque, doors, seats, kerb weight) are left null per the
// "no fabricated data" principle. See vault 02-Phases/Phase-2.5-UK-Data-Migration.md.
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

export type VcaVariant = {
  make: string;
  model: string;
  trim: string | null;
  engineSizeCc: number | null;
  fuelType: string | null; // normalised: Petrol | Diesel | Hybrid | Electric
  transmission: string | null; // Manual | Automatic
  horsepower: number | null; // PS
  mpgUrban: number | null;
  mpgExtraUrban: number | null;
  mpgCombined: number | null;
  co2Gkm: number | null;
};

// Manufacturer strings come in ALL CAPS or with legal suffixes ("MG MOTORS UK", "Chery UK Ltd").
// This is display formatting of a real value, not fabrication. Overrides for the messy ones; the
// rest get title-cased with a few acronyms kept upper.
const MAKE_OVERRIDES: Record<string, string> = {
  "MERCEDES-BENZ": "Mercedes-Benz",
  "ALFA ROMEO": "Alfa Romeo",
  "ASTON MARTIN LAGONDA": "Aston Martin",
  "BENTLEY MOTORS": "Bentley",
  "MG MOTORS UK": "MG",
  "CHRYSLER JEEP": "Jeep",
  "KGM UK MOTORS LTD": "KGM",
  "CHERY UK LTD": "Chery",
  "INEOS AUTOMOTIVE LTD": "Ineos",
  "SMART UK AUTOMOTIVE LTD": "Smart",
  "ROLLS ROYCE": "Rolls-Royce",
  "MORGAN MOTOR COMPANY": "Morgan",
};
const KEEP_UPPER = new Set(["BMW", "MG", "DS", "GWM", "SEAT", "KGM", "GENESIS", "MINI"]);

export function niceMake(raw: string): string {
  const key = raw.trim().toUpperCase();
  if (MAKE_OVERRIDES[key]) return MAKE_OVERRIDES[key];
  if (KEEP_UPPER.has(key)) return key === "MINI" || key === "GENESIS" ? title(key) : key;
  return title(key);
}

function title(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}

// Strip model-year markers anywhere ("500e MY25" -> "500e", "Junior MY25 & MY26" -> "Junior") and
// tidy the trailing artefacts the source leaves behind (stray comma/ampersand/hyphen, e.g. "C40,"
// "C-HR Hybrid -"). Meaningful suffixes are preserved: "+" (plug-in, e.g. "NX 450h+") and accents
// ("Coupé"). Display formatting of a real value, not fabrication — same basis as niceMake above.
export function cleanModel(raw: string): string {
  return raw
    .replace(/\bMY\d{2,4}\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s,&-]+$/g, "")
    .trim();
}

export function normalizeFuel(raw: string): string | null {
  const f = (raw || "").toLowerCase();
  if (!f) return null;
  if (f.includes("electric") && (f.includes("petrol") || f.includes("diesel"))) return "Hybrid";
  if (f === "electricity" || f === "electric") return "Electric";
  if (f.includes("diesel")) return "Diesel";
  if (f.includes("petrol")) return "Petrol"; // includes "Petrol / LPG"
  return null;
}

function num(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}
// A value that is meaningfully > 0 (VCA uses 0 to mean N/A for engine size, power, MPG).
function posInt(raw: string | undefined): number | null {
  const n = num(raw);
  return n != null && n > 0 ? Math.round(n) : null;
}
function posFloat(raw: string | undefined): number | null {
  const n = num(raw);
  return n != null && n > 0 ? n : null;
}

export function parseVcaCsv(path: string): VcaVariant[] {
  const content = readFileSync(path, "latin1");
  const records: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });

  const seen = new Set<string>();
  const out: VcaVariant[] = [];

  for (const r of records) {
    const make = niceMake(r["Manufacturer"] || "");
    const model = cleanModel(r["Model"] || "");
    if (!make || !model) continue;

    const fuelType = normalizeFuel(r["Fuel Type"] || "");
    const trim = (r["Description"] || "").replace(/\s+/g, " ").trim() || null;
    const co2raw = num(r["WLTP CO2"]);
    // CO2: real 0 for electric; for combustion a 0 means "not reported" -> null.
    const co2Gkm = fuelType === "Electric" ? co2raw ?? 0 : co2raw && co2raw > 0 ? Math.round(co2raw) : null;

    const v: VcaVariant = {
      make,
      model,
      trim,
      engineSizeCc: posInt(r["Engine Capacity"]),
      fuelType,
      transmission: (r["Manual or Automatic"] || "").trim() || null,
      horsepower: posInt(r["Engine Power (PS)"]),
      mpgUrban: posFloat(r["WLTP Imperial Low"]),
      mpgExtraUrban: posFloat(r["WLTP Imperial Extra High"]),
      mpgCombined: posFloat(r["WLTP Imperial Combined"]) ?? posFloat(r["WLTP Imperial Combined (Weighted)"]),
      co2Gkm,
    };

    const key = [v.make, v.model, v.trim, v.fuelType, v.engineSizeCc, v.horsepower, v.mpgCombined, v.co2Gkm].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }

  return out;
}
