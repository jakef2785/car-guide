// Community review aggregates + the scoring release gate.
// Per 01-Specification/Scoring-System.md: community reliability is display-only until a model
// has 10+ reviews — and only reviews that actually rate reliability count toward that threshold.
export const SCORING_MIN_REVIEWS = 10;

export type RatedReview = {
  reliabilityRating: number | null;
  runningCostRating: number | null;
};

export type ReviewAggregate = {
  count: number;
  avgReliability: number | null;
  avgRunningCost: number | null;
};

const avgToOneDp = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

const ratings = (reviews: RatedReview[], key: keyof RatedReview): number[] =>
  reviews.map((r) => r[key]).filter((v): v is number => v != null);

export function aggregateReviews(reviews: RatedReview[]): ReviewAggregate {
  return {
    count: reviews.length,
    avgReliability: avgToOneDp(ratings(reviews, "reliabilityRating")),
    avgRunningCost: avgToOneDp(ratings(reviews, "runningCostRating")),
  };
}

export function communityReliabilityForScoring(reviews: RatedReview[]): number | null {
  const rated = ratings(reviews, "reliabilityRating");
  if (rated.length < SCORING_MIN_REVIEWS) return null;
  return avgToOneDp(rated);
}
