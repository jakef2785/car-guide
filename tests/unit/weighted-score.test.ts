import {
  scoreModels,
  type CriterionKey,
  type ModelCriterionValues,
  type Weights,
} from "@/lib/scoring/weighted-score";

const W = (over: Partial<Weights> = {}): Weights => ({
  performance: 0,
  economy: 0,
  runningCost: 0,
  reliability: 0,
  recalls: 0,
  ...over,
});

const V = (over: Partial<ModelCriterionValues> = {}): ModelCriterionValues => ({
  performance: null,
  economy: null,
  runningCost: null,
  reliability: null,
  recalls: null,
  ...over,
});

describe("scoreModels", () => {
  it("normalises min-max per criterion: higher-is-better for performance/economy", () => {
    const out = scoreModels(
      [
        { id: "slow", values: V({ performance: 100 }) },
        { id: "mid", values: V({ performance: 200 }) },
        { id: "fast", values: V({ performance: 300 }) },
      ],
      W({ performance: 50 })
    );
    const byId = Object.fromEntries(out.map((m) => [m.id, m]));
    expect(byId.slow.criteria.performance.score).toBe(0);
    expect(byId.mid.criteria.performance.score).toBe(50);
    expect(byId.fast.criteria.performance.score).toBe(100);
    expect(byId.fast.finalScore).toBe(100);
  });

  it("normalises lower-is-better for running cost, reliability and recalls", () => {
    const out = scoreModels(
      [
        { id: "cheap", values: V({ runningCost: 500 }) },
        { id: "dear", values: V({ runningCost: 2500 }) },
      ],
      W({ runningCost: 100 })
    );
    const byId = Object.fromEntries(out.map((m) => [m.id, m]));
    expect(byId.cheap.criteria.runningCost.score).toBe(100);
    expect(byId.dear.criteria.runningCost.score).toBe(0);
  });

  it("computes the weighted average over the criteria that have data", () => {
    const out = scoreModels(
      [
        { id: "a", values: V({ performance: 300, economy: 30 }) },
        { id: "b", values: V({ performance: 100, economy: 60 }) },
      ],
      W({ performance: 75, economy: 25 })
    );
    const a = out.find((m) => m.id === "a")!;
    // a: perf 100 × 75 + economy 0 × 25 over Σw 100 = 75
    expect(a.finalScore).toBe(75);
  });

  it("is invariant to weight scale (weights need not sum to 100)", () => {
    const models = [
      { id: "a", values: V({ performance: 300, economy: 30 }) },
      { id: "b", values: V({ performance: 100, economy: 60 }) },
    ];
    const small = scoreModels(models, W({ performance: 3, economy: 1 }));
    const large = scoreModels(models, W({ performance: 75, economy: 25 }));
    expect(small.map((m) => m.finalScore)).toEqual(large.map((m) => m.finalScore));
  });

  it("excludes a missing criterion from that model's denominator and reports it", () => {
    const out = scoreModels(
      [
        { id: "full", values: V({ performance: 200, economy: 50 }) },
        { id: "noEco", values: V({ performance: 100, economy: null }) },
      ],
      W({ performance: 50, economy: 50 })
    );
    const noEco = out.find((m) => m.id === "noEco")!;
    // Only performance counts for noEco: score 0 (worst of the two) over weight 50 alone.
    expect(noEco.finalScore).toBe(0);
    expect(noEco.missing).toEqual(["economy"]);
    expect(noEco.criteria.economy.score).toBeNull();
    const full = out.find((m) => m.id === "full")!;
    expect(full.missing).toEqual([]);
  });

  it("gives a neutral 50 when a criterion has no spread across the compared set", () => {
    const out = scoreModels(
      [
        { id: "a", values: V({ economy: 40 }) },
        { id: "b", values: V({ economy: 40 }) },
      ],
      W({ economy: 100 })
    );
    for (const m of out) expect(m.criteria.economy.score).toBe(50);
  });

  it("returns null finalScore when all weights are zero or the model has no data, ranking those last", () => {
    const out = scoreModels(
      [
        { id: "nodata", values: V() },
        { id: "data", values: V({ performance: 100 }) },
      ],
      W({ performance: 60 })
    );
    expect(out[0].id).toBe("data");
    expect(out[1].finalScore).toBeNull();

    const zeroed = scoreModels([{ id: "data", values: V({ performance: 100 }) }], W());
    expect(zeroed[0].finalScore).toBeNull();
  });

  it("ranks by final score desc, breaking ties by reliability ratio ascending", () => {
    // Identical single-criterion values -> identical scores; the more reliable car wins the tie.
    const out = scoreModels(
      [
        { id: "flaky", values: V({ performance: 200, reliability: 1.4 }) },
        { id: "solid", values: V({ performance: 200, reliability: 0.7 }) },
      ],
      W({ performance: 100 })
    );
    expect(out.map((m) => m.id)).toEqual(["solid", "flaky"]);
  });

  it("ignores a criterion nobody has data for (recalls table empty) without distorting scores", () => {
    const out = scoreModels(
      [
        { id: "a", values: V({ performance: 300, recalls: null }) },
        { id: "b", values: V({ performance: 100, recalls: null }) },
      ],
      W({ performance: 50, recalls: 50 })
    );
    const a = out.find((m) => m.id === "a")!;
    expect(a.finalScore).toBe(100); // recalls weight dropped from denominator, not scored as 0
    expect(a.missing).toEqual(["recalls"]);
  });

  it("keeps contribution = score × weight ÷ scored-weight-sum on the breakdown", () => {
    const out = scoreModels(
      [
        { id: "a", values: V({ performance: 300, economy: 60 }) },
        { id: "b", values: V({ performance: 100, economy: 30 }) },
      ],
      W({ performance: 60, economy: 40 })
    );
    const a = out.find((m) => m.id === "a")!;
    expect(a.criteria.performance.contribution).toBeCloseTo(60);
    expect(a.criteria.economy.contribution).toBeCloseTo(40);
    expect(a.finalScore).toBeCloseTo(100);
  });
});
