// Parse the /score weight params (?performance=60&economy=80…). Same lenient philosophy as
// search-params: bad values fall back, never throw. Absent params default to 50 (a balanced
// equal-weight ranking on first visit); an explicit 0 removes the criterion.
import { z } from "zod";
import { CRITERION_KEYS, type CriterionKey, type Weights } from "@/lib/scoring/weighted-score";

const DEFAULT_WEIGHT = 50;

const weight = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number().min(0).max(100).optional()
  )
  .catch(undefined);

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseWeights(raw: RawParams): Weights {
  const out = {} as Weights;
  for (const key of CRITERION_KEYS) {
    out[key] = Math.round(weight.parse(first(raw[key])) ?? DEFAULT_WEIGHT);
  }
  return out;
}

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  performance: "Performance",
  economy: "Fuel economy",
  runningCost: "Running cost",
  reliability: "MOT reliability",
  recalls: "Recall history",
  communityReliability: "Owner-rated reliability",
};

export const CRITERION_SOURCES: Record<CriterionKey, string> = {
  performance: "VCA (engine power)",
  economy: "VCA (WLTP combined MPG)",
  runningCost: "VCA MPG / mi-per-kWh + GOV.UK VED bands + stated assumptions",
  reliability: "UK MOT results (DVSA data via motsearch)",
  recalls: "DVSA recalls",
  communityReliability: "Community reviews — counts only once a model has 10+ approved reviews",
};
