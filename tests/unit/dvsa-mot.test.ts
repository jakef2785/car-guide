import { MotAggregator } from "@/lib/data-pipeline/dvsa-mot";

// Header order is intentionally not the "obvious" one — the aggregator must resolve columns by
// name, not position.
const HEADER = ["test_id", "make", "test_result", "model", "failure_category"];

function feed(rows: string[][]) {
  const agg = new MotAggregator();
  agg.setHeader(HEADER);
  for (const r of rows) agg.addRow(r);
  return agg;
}

describe("MotAggregator", () => {
  it("computes pass rate, counting P and PRS as passes and excluding abandoned codes", () => {
    const agg = feed([
      ["1", "Ford", "P", "Focus", ""],
      ["2", "Ford", "PRS", "Focus", ""], // pass at station -> pass
      ["3", "Ford", "F", "Focus", "Brakes"],
      ["4", "Ford", "ABA", "Focus", ""], // abandoned -> excluded entirely
    ]);
    const [r] = agg.results(1, 5);
    expect(r).toMatchObject({ make: "Ford", model: "Focus", testCount: 3 });
    expect(r.passRate).toBeCloseTo(66.67, 1); // 2 of 3 (abandoned not counted)
  });

  it("ranks top failure categories by frequency", () => {
    const agg = feed([
      ["1", "VW", "F", "Golf", "Suspension"],
      ["2", "VW", "F", "Golf", "Brakes"],
      ["3", "VW", "F", "Golf", "Brakes"],
      ["4", "VW", "P", "Golf", ""],
    ]);
    const [r] = agg.results(1, 5);
    expect(r.topFailures[0]).toBe("Brakes"); // 2x beats Suspension 1x
    expect(r.passRate).toBeCloseTo(25, 1); // 1 of 4
  });

  it("drops groups below the minimum test floor (noise control)", () => {
    const agg = feed([["1", "Tesla", "P", "Model 3", ""]]);
    expect(agg.results(100, 5)).toHaveLength(0);
    expect(agg.results(1, 5)).toHaveLength(1);
  });

  it("keeps make/model groups separate", () => {
    const agg = feed([
      ["1", "Ford", "P", "Focus", ""],
      ["2", "Ford", "F", "Fiesta", "Lights"],
    ]);
    expect(agg.results(1, 5)).toHaveLength(2);
  });
});
