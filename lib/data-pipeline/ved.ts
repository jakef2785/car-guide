// UK Vehicle Excise Duty (road tax) — computed from CO2 g/km using GOV.UK bands.
// Source: https://www.gov.uk/vehicle-tax-rate-tables, verified live 2026-06-28 (rates current
// for 2026/27, page last updated 2026-05-21). Re-check this table at least annually — VED bands
// change with the Budget. Caveat shown to users per vault Data-Sources.md: "confirm current
// rates at GOV.UK".
//
// We compute the FIRST-YEAR rate, not the flat standard rate. The standard (year 2+) rate is
// a flat £200 for virtually every car regardless of CO2 as of the 2026/27 rates, so it carries
// no comparison signal. The first-year, CO2-banded rate is what genuinely varies by car and is
// what a buyer comparing models would want to see. This is a judgment call, not something the
// spec stated explicitly — logged as a decision if questioned later.
//
// Known gap: we don't have RDE2 (diesel NOx) compliance data from CarVector or NHTSA, so a
// diesel's exact band can't be determined with certainty. We default diesels to the *higher*
// (non-RDE2) band — the conservative assumption — and the caller should surface
// `assumptionApplied` so the UI can show a caveat rather than presenting a guess as fact.

export type FuelCategory = "petrol" | "diesel" | "diesel-rde2" | "alternative" | "electric";

interface VedBand {
  maxCo2: number; // inclusive upper bound of the band, in g/km
  // Rate for diesel-rde2 / petrol / alternative-fuel / zero-emission cars
  standardRate: number;
  // Rate for non-RDE2-compliant diesel
  dieselSurchargeRate: number;
}

// Ordered ascending by maxCo2. Last band (Infinity) covers "over 255g/km".
const FIRST_YEAR_BANDS: VedBand[] = [
  { maxCo2: 0, standardRate: 10, dieselSurchargeRate: 10 },
  { maxCo2: 50, standardRate: 115, dieselSurchargeRate: 135 },
  { maxCo2: 75, standardRate: 135, dieselSurchargeRate: 280 },
  { maxCo2: 90, standardRate: 280, dieselSurchargeRate: 365 },
  { maxCo2: 100, standardRate: 365, dieselSurchargeRate: 405 },
  { maxCo2: 110, standardRate: 405, dieselSurchargeRate: 455 },
  { maxCo2: 130, standardRate: 455, dieselSurchargeRate: 560 },
  { maxCo2: 150, standardRate: 560, dieselSurchargeRate: 1410 },
  { maxCo2: 170, standardRate: 1410, dieselSurchargeRate: 2270 },
  { maxCo2: 190, standardRate: 2270, dieselSurchargeRate: 3420 },
  { maxCo2: 225, standardRate: 3420, dieselSurchargeRate: 4850 },
  { maxCo2: 255, standardRate: 4850, dieselSurchargeRate: 5690 },
  { maxCo2: Infinity, standardRate: 5690, dieselSurchargeRate: 5690 },
];

// Standard (year 2+) flat rate, current 2026/27. Kept separate in case ongoing-cost UI wants it.
export const STANDARD_ANNUAL_RATE_GBP = 200;

export interface VedResult {
  firstYearRateGbp: number;
  /** True if we had to assume non-RDE2 diesel because compliance data wasn't available. */
  assumptionApplied: boolean;
}

// Best-effort mapping from the free-text fuel_type strings CarVector/EPA actually return
// (e.g. "Gasoline", "Diesel", "Electric", "Hybrid") to our banding categories. Unmapped values
// fall back to "petrol" rates (the most common case) — callers should log unmapped values
// during Phase 1 so we can extend this rather than silently mis-band exotic fuel types.
export function categorizeFuelType(fuelType: string | null | undefined): FuelCategory {
  const normalized = (fuelType ?? "").toLowerCase();
  if (normalized.includes("electric")) return "electric";
  if (normalized.includes("hybrid") || normalized.includes("lpg") || normalized.includes("cng")) {
    return "alternative";
  }
  if (normalized.includes("diesel")) return "diesel"; // RDE2 compliance unknown — see header note
  return "petrol";
}

export function calculateFirstYearVed(co2Gkm: number | null | undefined, fuelType: string | null | undefined): VedResult {
  const co2 = co2Gkm ?? 0;
  const band = FIRST_YEAR_BANDS.find((b) => co2 <= b.maxCo2) ?? FIRST_YEAR_BANDS[FIRST_YEAR_BANDS.length - 1];
  const category = categorizeFuelType(fuelType);

  if (category === "diesel") {
    return { firstYearRateGbp: band.dieselSurchargeRate, assumptionApplied: true };
  }

  return { firstYearRateGbp: band.standardRate, assumptionApplied: false };
}
