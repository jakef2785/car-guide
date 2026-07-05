// Builds each model's raw criterion values for the weighted scorer. Derivations are pure and
// exported for unit tests; only fetchScoringInputs touches the DB.
import { prisma } from "@/lib/prisma";
import type { ModelCriterionValues } from "@/lib/scoring/weighted-score";

// --- Running-cost assumptions (documented on the page; approximate UK figures, mid-2026). ---
// Fuel price per litre by normalised fuel type; hybrids buy petrol. EVs are excluded from the
// running-cost criterion entirely — we don't ingest electricity consumption, and comparing
// "VED-only" EVs against "VED+fuel" ICE cars would fabricate an advantage.
export const RUNNING_COST_ASSUMPTIONS = {
  annualMiles: 7500, // approx. UK average annual car mileage
  petrolPricePerLitre: 1.42,
  dieselPricePerLitre: 1.49,
  litresPerGallon: 4.54609, // imperial
} as const;

// Plug-in hybrids report the WLTP *weighted* combined figure (battery assumed charged), which
// produces anything from ~40 to 706 "mpg" — a different test regime, not comparable with normal
// combined MPG and unrepresentative of fuel actually bought. Full hybrids (Toyota-style) report
// a normal combined figure and stay comparable. The VCA "Powertrain" string tells the regimes
// apart exactly (PHEV vs HEV/MHEV/ICE); a magnitude guard covers rows without one (no real
// petrol/diesel/full-hybrid exceeds ~80 WLTP combined mpg). This drops data from comparison
// rather than inventing any — the raw figure still shows on the detail page.
const WEIGHTED_REGIME = /plug-?in|phev|range.?extend|ofvs?/i;
const IMPLAUSIBLE_COMBINED_MPG = 80;

export function comparableMpg(
  mpgCombined: number | null,
  fuelType: string | null,
  powertrain: string | null
): number | null {
  if (mpgCombined === null || mpgCombined <= 0) return null;
  if (powertrain) return WEIGHTED_REGIME.test(powertrain) ? null : mpgCombined;
  if (fuelType?.toLowerCase() === "hybrid" && mpgCombined > IMPLAUSIBLE_COMBINED_MPG) return null;
  return mpgCombined;
}

export function deriveAnnualFuelCost(
  mpgCombined: number | null,
  fuelType: string | null,
  powertrain: string | null
): number | null {
  const mpg = comparableMpg(mpgCombined, fuelType, powertrain);
  if (mpg === null || !fuelType) return null;
  const f = fuelType.toLowerCase();
  if (f === "electric") return null;
  const pricePerLitre =
    f === "diesel" ? RUNNING_COST_ASSUMPTIONS.dieselPricePerLitre : RUNNING_COST_ASSUMPTIONS.petrolPricePerLitre;
  const gallons = RUNNING_COST_ASSUMPTIONS.annualMiles / mpg;
  return gallons * RUNNING_COST_ASSUMPTIONS.litresPerGallon * pricePerLitre;
}

// Cheapest variant's (first-year VED + annual fuel estimate). Needs BOTH components — a car
// missing either is "no data", not "cheap".
export function deriveRunningCost(
  variants: Array<{
    mpgCombined: number | null;
    fuelType: string | null;
    powertrain: string | null;
    vedAnnualGbp: number | null;
  }>
): number | null {
  let best: number | null = null;
  for (const v of variants) {
    const fuel = deriveAnnualFuelCost(v.mpgCombined, v.fuelType, v.powertrain);
    if (fuel === null || v.vedAnnualGbp === null) continue;
    const total = v.vedAnnualGbp + fuel;
    if (best === null || total < best) best = total;
  }
  return best;
}

// Mean across model years of (defects per 100 ÷ same-year average). < 1 is better than average.
export function deriveReliabilityRatio(
  rows: Array<{ defectsPer100: number | null; yearAvgPer100: number | null }>
): number | null {
  const ratios = rows
    .filter((r) => r.defectsPer100 !== null && r.yearAvgPer100 !== null && r.yearAvgPer100 > 0)
    .map((r) => r.defectsPer100! / r.yearAvgPer100!);
  if (ratios.length === 0) return null;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

export type ScoringInput = {
  id: string;
  makeName: string;
  makeSlug: string;
  modelName: string;
  modelSlug: string;
  values: ModelCriterionValues;
  dataFetchedAt: Date | null; // newest variant fetch date, for the source line
};

export async function fetchScoringInputs(): Promise<ScoringInput[]> {
  const [models, anyRecalls] = await Promise.all([
    prisma.model.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        make: { select: { name: true, slug: true } },
        variants: {
          select: {
            horsepower: true,
            mpgCombined: true,
            fuelType: true,
            powertrain: true,
            vedAnnualGbp: true,
            dataFetchedAt: true,
          },
        },
        motReliability: { select: { defectsPer100: true, yearAvgPer100: true } },
        _count: { select: { recalls: true } },
      },
      orderBy: [{ make: { name: "asc" } }, { name: "asc" }],
    }),
    // While the recalls table is empty the DVSA file simply hasn't been obtained — a 0 count is
    // "no data", not "zero recalls". Once any recalls exist, counts are real (including real 0s).
    prisma.recall.count().then((n) => n > 0),
  ]);

  return models.map((m) => {
    const variants = m.variants.map((v) => ({
      horsepower: v.horsepower,
      mpgCombined: v.mpgCombined === null ? null : Number(v.mpgCombined),
      fuelType: v.fuelType,
      powertrain: v.powertrain,
      vedAnnualGbp: v.vedAnnualGbp,
    }));
    const rel = m.motReliability.map((r) => ({
      defectsPer100: r.defectsPer100 === null ? null : Number(r.defectsPer100),
      yearAvgPer100: r.yearAvgPer100 === null ? null : Number(r.yearAvgPer100),
    }));
    const power = variants.map((v) => v.horsepower).filter((n): n is number => n !== null);
    const mpg = variants
      .map((v) => comparableMpg(v.mpgCombined, v.fuelType, v.powertrain))
      .filter((n): n is number => n !== null);
    const fetchDates = m.variants.map((v) => v.dataFetchedAt);

    return {
      id: m.id,
      makeName: m.make?.name ?? "",
      makeSlug: m.make?.slug ?? "",
      modelName: m.name,
      modelSlug: m.slug,
      dataFetchedAt: fetchDates.length ? new Date(Math.max(...fetchDates.map((d) => d.getTime()))) : null,
      values: {
        performance: power.length ? Math.max(...power) : null,
        economy: mpg.length ? Math.max(...mpg) : null,
        runningCost: deriveRunningCost(variants),
        reliability: deriveReliabilityRatio(rel),
        recalls: anyRecalls ? m._count.recalls : null,
      },
    };
  });
}
