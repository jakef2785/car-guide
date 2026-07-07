import {
  aggregateReviews,
  communityReliabilityForScoring,
  SCORING_MIN_REVIEWS,
} from "@/lib/reviews/aggregate";

type R = { reliabilityRating: number | null; runningCostRating: number | null };
const r = (rel: number | null, run: number | null): R => ({
  reliabilityRating: rel,
  runningCostRating: run,
});

describe("aggregateReviews", () => {
  it("returns an empty aggregate for no reviews", () => {
    expect(aggregateReviews([])).toEqual({
      count: 0,
      avgReliability: null,
      avgRunningCost: null,
    });
  });

  it("averages ratings to one decimal place", () => {
    const agg = aggregateReviews([r(5, 2), r(4, 3), r(4, 2)]);
    expect(agg.count).toBe(3);
    expect(agg.avgReliability).toBe(4.3);
    expect(agg.avgRunningCost).toBe(2.3);
  });

  it("averages over non-null ratings only, but counts every review", () => {
    const agg = aggregateReviews([r(5, null), r(3, 4), r(null, null)]);
    expect(agg.count).toBe(3);
    expect(agg.avgReliability).toBe(4);
    expect(agg.avgRunningCost).toBe(4);
  });

  it("returns null averages when no review carries that rating", () => {
    const agg = aggregateReviews([r(null, 3)]);
    expect(agg.avgReliability).toBeNull();
    expect(agg.avgRunningCost).toBe(3);
  });
});

describe("communityReliabilityForScoring", () => {
  const rated = (n: number, rating = 4): R[] => Array.from({ length: n }, () => r(rating, 3));

  it("withholds community reliability below the 10-review threshold", () => {
    expect(communityReliabilityForScoring(rated(SCORING_MIN_REVIEWS - 1))).toBeNull();
    expect(communityReliabilityForScoring([])).toBeNull();
  });

  it("releases the average at the threshold", () => {
    expect(communityReliabilityForScoring(rated(SCORING_MIN_REVIEWS))).toBe(4);
  });

  it("counts only reviews that actually rate reliability toward the threshold", () => {
    // 10 reviews but only 9 rate reliability — still withheld.
    const reviews = [...rated(9), r(null, 5)];
    expect(communityReliabilityForScoring(reviews)).toBeNull();
  });

  it("documents the threshold as 10", () => {
    expect(SCORING_MIN_REVIEWS).toBe(10);
  });
});
