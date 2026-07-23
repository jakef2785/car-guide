import { planEnrichmentMoves, planReviewMoves } from "@/lib/data-pipeline/enrichment-migration";

describe("planEnrichmentMoves", () => {
  it("picks the richest donor per target by THIS criterion's own count", () => {
    // Two stale models collapse onto the same target. Donor A has more rows for this criterion
    // than donor B, so A should win even if B would win a DIFFERENT criterion's count.
    const moves = planEnrichmentMoves(
      [
        { staleId: "a", targetId: "t1", count: 10 },
        { staleId: "b", targetId: "t1", count: 3 },
      ],
      []
    );
    expect(moves).toEqual([{ staleId: "a", targetId: "t1" }]);
  });

  it("does not couple two criteria's donor selection — the documented bug", () => {
    // Real scenario: A has more reliability rows (wins reliability), B has more recalls.
    // Each criterion must independently pick its own richest donor.
    const relMoves = planEnrichmentMoves(
      [
        { staleId: "a", targetId: "t1", count: 10 }, // A: 10 reliability rows
        { staleId: "b", targetId: "t1", count: 5 }, // B: 5 reliability rows
      ],
      []
    );
    const recallMoves = planEnrichmentMoves(
      [
        { staleId: "a", targetId: "t1", count: 3 }, // A: 3 recalls
        { staleId: "b", targetId: "t1", count: 8 }, // B: 8 recalls — the bigger set
      ],
      []
    );
    expect(relMoves).toEqual([{ staleId: "a", targetId: "t1" }]);
    expect(recallMoves).toEqual([{ staleId: "b", targetId: "t1" }]); // B wins recalls, not A
  });

  it("skips targets that already have data (not stale) for this criterion", () => {
    const moves = planEnrichmentMoves(
      [{ staleId: "a", targetId: "t1", count: 10 }],
      ["t1"]
    );
    expect(moves).toEqual([]);
  });

  it("ignores donors with zero count, no target, or a self-referential target", () => {
    const moves = planEnrichmentMoves(
      [
        { staleId: "a", targetId: "t1", count: 0 },
        { staleId: "b", targetId: null, count: 5 },
        { staleId: "c", targetId: "c", count: 5 },
        { staleId: "d", targetId: "t2", count: 4 },
      ],
      []
    );
    expect(moves).toEqual([{ staleId: "d", targetId: "t2" }]);
  });

  it("handles three-way collisions onto one target, still picking the single richest", () => {
    const moves = planEnrichmentMoves(
      [
        { staleId: "a", targetId: "t1", count: 2 },
        { staleId: "b", targetId: "t1", count: 9 },
        { staleId: "c", targetId: "t1", count: 4 },
      ],
      []
    );
    expect(moves).toEqual([{ staleId: "b", targetId: "t1" }]);
  });

  it("produces independent moves for unrelated targets", () => {
    const moves = planEnrichmentMoves(
      [
        { staleId: "a", targetId: "t1", count: 5 },
        { staleId: "b", targetId: "t2", count: 7 },
      ],
      []
    );
    expect(moves.sort((x, y) => x.targetId.localeCompare(y.targetId))).toEqual([
      { staleId: "a", targetId: "t1" },
      { staleId: "b", targetId: "t2" },
    ]);
  });
});

describe("planReviewMoves", () => {
  it("moves ALL reviewed stale models to their targets — no richest-donor selection", () => {
    // Both donors share one target; unlike enrichment, BOTH move (reviews merge additively —
    // dropping the smaller donor would destroy unique user content).
    const { moves, blockedStaleIds } = planReviewMoves([
      { staleId: "a", targetId: "t1", reviewCount: 10 },
      { staleId: "b", targetId: "t1", reviewCount: 3 },
    ]);
    expect(moves).toEqual([
      { staleId: "a", targetId: "t1" },
      { staleId: "b", targetId: "t1" },
    ]);
    expect(blockedStaleIds).toEqual([]);
  });

  it("blocks pruning a reviewed stale model with no successor instead of letting it cascade", () => {
    const { moves, blockedStaleIds } = planReviewMoves([
      { staleId: "dropped", targetId: null, reviewCount: 2 },
    ]);
    expect(moves).toEqual([]);
    expect(blockedStaleIds).toEqual(["dropped"]);
  });

  it("ignores stale models with no reviews — nothing to protect, prune freely", () => {
    const { moves, blockedStaleIds } = planReviewMoves([
      { staleId: "empty-renamed", targetId: "t1", reviewCount: 0 },
      { staleId: "empty-dropped", targetId: null, reviewCount: 0 },
    ]);
    expect(moves).toEqual([]);
    expect(blockedStaleIds).toEqual([]);
  });
});
