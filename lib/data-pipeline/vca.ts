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
  powertrain: string | null; // raw VCA string, e.g. "Plug-in Hybrid Electric Vehicle (PHEV)"
  transmission: string | null; // Manual | Automatic
  horsepower: number | null; // PS
  mpgUrban: number | null;
  mpgExtraUrban: number | null;
  mpgCombined: number | null;
  co2Gkm: number | null;
  milesPerKwh: number | null; // EV/PHEV efficiency (WLTP)
  maxRangeMiles: number | null; // EV/PHEV electric range (WLTP)
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

// Strip model-year markers anywhere ("500e MY25" -> "500e", "Vantage 2021MY" -> "Vantage",
// "A-Class Model Year 2026" -> "A-Class", "Civic 2023" -> "Civic"), the marketing "New " prefix
// ("New ZOE" -> "ZOE"), and tidy the trailing artefacts the source leaves behind (stray
// comma/ampersand/hyphen, e.g. "C40," "C-HR Hybrid -"). A year that IS the whole name is kept
// (Peugeot "2008"/"3008"/"5008") — the trailing-year rule requires something before it.
// Meaningful suffixes are preserved: "+" (plug-in, e.g. "NX 450h+") and accents ("Coupé").
// Display formatting of a real value, not fabrication — same basis as niceMake above.
export function cleanModel(raw: string): string {
  return raw
    .replace(/\bmodel year( post)?\s*\d{4}(\.\d+)?/gi, " ") // "Model Year 2026", "Model Year Post 2024.00"
    .replace(/\bMY\s?\d{2,4}(\.\d+)?\b/gi, " ") // "MY25", "MY 2026"
    .replace(/\b\d{4}\s?MY\b/gi, " ") // "2021MY"
    .replace(/^new\s+/i, "") // "New Focus" -> "Focus"
    .replace(/\s+(19|20)\d{2}\s*$/g, " ") // trailing bare year: "Civic 2023" -> "Civic"
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

  // One variant per user-facing identity (make/model/trim/fuel/engine/power/gearbox). VCA lists
  // the same trim repeatedly for different test configurations (wheel/equipment lines) whose only
  // difference is the WLTP figures — a buyer picks a trim, not a test config, so those rows would
  // render as indistinguishable duplicates. Per identity we keep ONE whole source row (figures are
  // never mixed across rows): the row with the most economy fields, then the best combined MPG
  // (the manufacturer-headline configuration), then the lowest CO2, else first occurrence.
  const byIdentity = new Map<string, VcaVariant>();

  const econFields = ["mpgUrban", "mpgExtraUrban", "mpgCombined", "co2Gkm"] as const;
  const econCount = (v: VcaVariant) => econFields.filter((f) => v[f] !== null).length;
  const beats = (a: VcaVariant, b: VcaVariant): boolean => {
    if (econCount(a) !== econCount(b)) return econCount(a) > econCount(b);
    const mpgA = a.mpgCombined ?? -1;
    const mpgB = b.mpgCombined ?? -1;
    if (mpgA !== mpgB) return mpgA > mpgB;
    const co2A = a.co2Gkm ?? Number.POSITIVE_INFINITY;
    const co2B = b.co2Gkm ?? Number.POSITIVE_INFINITY;
    return co2A < co2B;
  };

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
      powertrain: (r["Powertrain"] || "").replace(/\s+/g, " ").trim() || null,
      transmission: (r["Manual or Automatic"] || "").trim() || null,
      horsepower: posInt(r["Engine Power (PS)"]),
      mpgUrban: posFloat(r["WLTP Imperial Low"]),
      mpgExtraUrban: posFloat(r["WLTP Imperial Extra High"]),
      mpgCombined: posFloat(r["WLTP Imperial Combined"]) ?? posFloat(r["WLTP Imperial Combined (Weighted)"]),
      co2Gkm,
      // VCA uses 0 for "not reported" here too — posFloat/posInt already treat 0 as null.
      milesPerKwh: posFloat(r["Electric energy consumption Miles/kWh"]),
      maxRangeMiles: posInt(r["Maximum range (Miles)"]),
    };

    // Case-insensitive: model/trim spellings that differ only in case ("Zoe" vs "ZOE") map to the
    // same URL slug downstream, so they are the same identity here too.
    const key = [v.make, v.model, v.trim, v.fuelType, v.engineSizeCc, v.horsepower, v.transmission]
      .join("|")
      .toLowerCase();
    const held = byIdentity.get(key);
    if (!held || beats(v, held)) byIdentity.set(key, v);
  }

  return Array.from(byIdentity.values());
}
