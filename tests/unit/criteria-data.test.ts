import {
  deriveAnnualFuelCost,
  deriveRunningCost,
  deriveReliabilityRatio,
  RUNNING_COST_ASSUMPTIONS,
} from "@/lib/scoring/criteria-data";
import { parseWeights } from "@/lib/scoring/score-params";

describe("deriveAnnualFuelCost", () => {
  it("computes miles/mpg × litres/gallon × price", () => {
    const cost = deriveAnnualFuelCost(50, "Petrol")!;
    const expected = (7500 / 50) * 4.54609 * RUNNING_COST_ASSUMPTIONS.petrolPricePerLitre;
    expect(cost).toBeCloseTo(expected);
  });
  it("uses the diesel price for diesel and treats hybrids as petrol buyers", () => {
    expect(deriveAnnualFuelCost(50, "Diesel")!).toBeGreaterThan(deriveAnnualFuelCost(50, "Hybrid")!);
  });
  it("returns null for EVs and missing MPG — never a fabricated cost", () => {
    expect(deriveAnnualFuelCost(null, "Petrol")).toBeNull();
    expect(deriveAnnualFuelCost(50, "Electric")).toBeNull();
    expect(deriveAnnualFuelCost(0, "Petrol")).toBeNull();
  });
});

describe("deriveRunningCost", () => {
  it("takes the cheapest variant with BOTH fuel and VED data", () => {
    const cost = deriveRunningCost([
      { mpgCombined: 40, fuelType: "Petrol", vedAnnualGbp: 200 }, // fuel ~968 + 200
      { mpgCombined: 60, fuelType: "Petrol", vedAnnualGbp: 180 }, // fuel ~645 + 180 <- cheapest
      { mpgCombined: 70, fuelType: "Petrol", vedAnnualGbp: null }, // incomplete -> skipped
    ])!;
    expect(cost).toBeCloseTo((7500 / 60) * 4.54609 * 1.42 + 180, 0);
  });
  it("returns null when no variant has complete data (e.g. an EV-only model)", () => {
    expect(deriveRunningCost([{ mpgCombined: null, fuelType: "Electric", vedAnnualGbp: 10 }])).toBeNull();
  });
});

describe("deriveReliabilityRatio", () => {
  it("averages defects/year-average across model years", () => {
    const ratio = deriveReliabilityRatio([
      { defectsPer100: 50, yearAvgPer100: 100 }, // 0.5
      { defectsPer100: 150, yearAvgPer100: 100 }, // 1.5
      { defectsPer100: null, yearAvgPer100: 100 }, // skipped
      { defectsPer100: 10, yearAvgPer100: 0 }, // skipped (bad denominator)
    ])!;
    expect(ratio).toBeCloseTo(1.0);
  });
  it("returns null with no usable rows", () => {
    expect(deriveReliabilityRatio([])).toBeNull();
  });
});

describe("parseWeights", () => {
  it("defaults every criterion to 50 when absent", () => {
    expect(parseWeights({})).toEqual({
      performance: 50,
      economy: 50,
      runningCost: 50,
      reliability: 50,
      recalls: 50,
    });
  });
  it("keeps explicit zeros, clamps junk to the default, rounds decimals", () => {
    const w = parseWeights({ performance: "0", economy: "banana", runningCost: "72.6", reliability: "", recalls: "101" });
    expect(w.performance).toBe(0);
    expect(w.economy).toBe(50); // invalid -> default
    expect(w.runningCost).toBe(73);
    expect(w.reliability).toBe(50); // empty -> default
    expect(w.recalls).toBe(50); // out of range -> default
  });
});
