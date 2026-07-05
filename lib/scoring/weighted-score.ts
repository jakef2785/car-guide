// Weighted scoring algorithm. Spec: vault 01-Specification/Scoring-System.md, adapted to the UK
// data landed in Phase 2.5 (see daily log 2026-07-05):
//   performance  — max variant power (PS), higher better
//   economy      — max variant WLTP combined MPG, higher better
//   runningCost  — annual £ estimate (VED + fuel), lower better
//   reliability  — MOT defects vs same-year average (ratio, mean across years), lower better
//                  (replaces the US-era "complaint volume" criterion)
//   recalls      — recall count, lower better ("No data available" until the DVSA file lands)
//
// final_score = Σ (criterion_score × user_weight) / Σ user_weights — but a model is never
// punished for a data gap: criteria with no value are excluded from that model's numerator AND
// denominator, and reported in `missing` so the UI can label them "No data available" (the
// Guiding-Principles "no fabricated data" rule applied to scoring).
//
// Criterion scores are min–max normalised 0–100 across the compared set, so a score means
// "relative to the cars in this comparison", not an absolute grade. A criterion with no spread
// (everyone equal) scores a neutral 50. Ties in the final score are broken by the MOT
// reliability ratio ascending (the spec's tie-break, ported from complaint volume).

export type CriterionKey = "performance" | "economy" | "runningCost" | "reliability" | "recalls";

export const CRITERION_KEYS: CriterionKey[] = [
  "performance",
  "economy",
  "runningCost",
  "reliability",
  "recalls",
];

// true = a bigger raw value is better; false = smaller is better.
const HIGHER_IS_BETTER: Record<CriterionKey, boolean> = {
  performance: true,
  economy: true,
  runningCost: false,
  reliability: false,
  recalls: false,
};

export type ModelCriterionValues = Record<CriterionKey, number | null>;

export type Weights = Record<CriterionKey, number>; // 0–100 each; need not sum to 100

export type ScoredCriterion = {
  raw: number | null;
  score: number | null; // 0–100, null when raw is null or weight is 0
  weight: number;
  contribution: number | null; // score × weight / Σ scored weights — what it added to the final
};

export type ScoredModel<Id> = {
  id: Id;
  finalScore: number | null; // null when no weighted criterion has data
  criteria: Record<CriterionKey, ScoredCriterion>;
  missing: CriterionKey[]; // weighted criteria this model has no data for
};

export function scoreModels<Id>(
  models: Array<{ id: Id; values: ModelCriterionValues }>,
  weights: Weights
): Array<ScoredModel<Id>> {
  const active = CRITERION_KEYS.filter((k) => weights[k] > 0);

  // Min–max bounds per active criterion, over models that have a value.
  const bounds = new Map<CriterionKey, { min: number; max: number }>();
  for (const key of active) {
    const vals = models.map((m) => m.values[key]).filter((v): v is number => v !== null);
    if (vals.length > 0) bounds.set(key, { min: Math.min(...vals), max: Math.max(...vals) });
  }

  const normalise = (key: CriterionKey, raw: number): number => {
    const b = bounds.get(key)!;
    if (b.max === b.min) return 50; // no spread — neutral, not "best" or "worst"
    const t = (raw - b.min) / (b.max - b.min);
    return (HIGHER_IS_BETTER[key] ? t : 1 - t) * 100;
  };

  const scored = models.map((m) => {
    const criteria = {} as Record<CriterionKey, ScoredCriterion>;
    const missing: CriterionKey[] = [];
    let weightedSum = 0;
    let weightSum = 0;

    for (const key of CRITERION_KEYS) {
      const raw = m.values[key];
      const weight = weights[key];
      const isActive = weight > 0;
      const score = isActive && raw !== null ? normalise(key, raw) : null;
      criteria[key] = { raw, score, weight, contribution: null };
      if (!isActive) continue;
      if (score === null) {
        missing.push(key);
      } else {
        weightedSum += score * weight;
        weightSum += weight;
      }
    }

    const finalScore = weightSum > 0 ? weightedSum / weightSum : null;
    if (finalScore !== null) {
      for (const key of CRITERION_KEYS) {
        const c = criteria[key];
        if (c.score !== null) c.contribution = (c.score * c.weight) / weightSum;
      }
    }
    return { id: m.id, finalScore, criteria, missing };
  });

  return scored.sort((a, b) => {
    if (a.finalScore === null && b.finalScore === null) return 0;
    if (a.finalScore === null) return 1; // unscoreable models rank last, in input order
    if (b.finalScore === null) return -1;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    const relA = a.criteria.reliability.raw ?? Number.POSITIVE_INFINITY;
    const relB = b.criteria.reliability.raw ?? Number.POSITIVE_INFINITY;
    return relA - relB;
  });
}
