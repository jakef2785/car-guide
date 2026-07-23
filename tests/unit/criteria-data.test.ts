import {
  comparableMpg,
  deriveAnnualFuelCost,
  deriveRunningCost,
  deriveReliabilityRatio,
  RUNNING_COST_ASSUMPTIONS,
} from "@/lib/scoring/criteria-data";
import { STANDARD_ANNUAL_RATE_GBP } from "@/lib/data-pipeline/ved";
import { parseWeights } from "@/lib/scoring/score-params";

const PHEV = "Plug-in Hybrid Electric Vehicle (PHEV)";
const HEV = "Hybrid Electric Vehicle (HEV)";
const ICE = "Internal Combustion Engine (ICE)";

describe("comparableMpg (PHEV weighted-test figures are a different measurement, not comparable)", () => {
  it("uses the VCA powertrain string to tell test regimes apart", () => {
    expect(comparableMpg(52.3, "Hybrid", HEV)).toBe(52.3); // full hybrid, normal combined figure
    expect(comparableMpg(706.3, "Hybrid", PHEV)).toBeNull(); // weighted-test artefact
    expect(comparableMpg(64.2, "Hybrid", PHEV)).toBeNull(); // thirsty PHEV — plausible number, wrong regime
    expect(comparableMpg(45.6, "Petrol", ICE)).toBe(45.6);
  });
  it("falls back to a magnitude guard when powertrain is missing", () => {
    expect(comparableMpg(706.3, "Hybrid", null)).toBeNull();
    expect(comparableMpg(52.3, "Hybrid", null)).toBe(52.3);
    expect(comparableMpg(70.6, "Petrol", null)).toBe(70.6); // catalogue's best pure-petrol figure stays
  });
});

describe("deriveAnnualFuelCost", () => {
  it("computes miles/mpg × litres/gallon × price", () => {
    const cost = deriveAnnualFuelCost(50, "Petrol", ICE)!;
    const expected = (7500 / 50) * 4.54609 * RUNNING_COST_ASSUMPTIONS.petrolPricePerLitre;
    expect(cost).toBeCloseTo(expected);
  });
  it("uses the diesel price for diesel and treats full hybrids as petrol buyers", () => {
    expect(deriveAnnualFuelCost(50, "Diesel", ICE)!).toBeGreaterThan(deriveAnnualFuelCost(50, "Hybrid", HEV)!);
  });
  it("returns null for EVs, PHEVs and missing MPG — never a fabricated cost", () => {
    expect(deriveAnnualFuelCost(null, "Petrol", ICE)).toBeNull();
    expect(deriveAnnualFuelCost(50, "Electric", null)).toBeNull();
    expect(deriveAnnualFuelCost(0, "Petrol", ICE)).toBeNull();
    expect(deriveAnnualFuelCost(64.2, "Hybrid", PHEV)).toBeNull();
  });
});

describe("deriveRunningCost", () => {
  // Annual VED is the flat £200 standard rate for every car — a constant offset. First-year
  // (CO2-banded) VED is a one-time purchase cost and must NOT appear in the annual figure.
  it("takes the cheapest variant's fuel cost plus the flat standard-rate VED", () => {
    const cost = deriveRunningCost([
      { mpgCombined: 40, fuelType: "Petrol", powertrain: ICE, milesPerKwh: null }, // fuel ~968
      { mpgCombined: 60, fuelType: "Petrol", powertrain: ICE, milesPerKwh: null }, // fuel ~645 <- cheapest
    ])!;
    expect(cost).toBeCloseTo((7500 / 60) * 4.54609 * 1.42 + STANDARD_ANNUAL_RATE_GBP, 0);
  });
  it("does not skip a variant for lacking first-year VED — only fuel/energy data gates scoring", () => {
    const cost = deriveRunningCost([
      { mpgCombined: 70, fuelType: "Petrol", powertrain: ICE, milesPerKwh: null },
    ])!;
    expect(cost).toBeCloseTo((7500 / 70) * 4.54609 * 1.42 + STANDARD_ANNUAL_RATE_GBP, 0);
  });
  it("scores an EV via electricity cost: miles ÷ mi/kWh × £/kWh + standard VED", () => {
    const cost = deriveRunningCost([
      { mpgCombined: null, fuelType: "Electric", powertrain: null, milesPerKwh: 4.0 },
    ])!;
    expect(cost).toBeCloseTo(
      (7500 / 4.0) * RUNNING_COST_ASSUMPTIONS.electricityPricePerKwh + STANDARD_ANNUAL_RATE_GBP,
      0
    );
  });
  it("picks the cheapest across mixed EV and petrol variants of one model", () => {
    // EV at 4 mi/kWh ≈ £490 energy — cheaper than the petrol at 60mpg (~£645); same VED offset.
    const cost = deriveRunningCost([
      { mpgCombined: 60, fuelType: "Petrol", powertrain: ICE, milesPerKwh: null },
      { mpgCombined: null, fuelType: "Electric", powertrain: null, milesPerKwh: 4.0 },
    ])!;
    expect(cost).toBeCloseTo(
      (7500 / 4.0) * RUNNING_COST_ASSUMPTIONS.electricityPricePerKwh + STANDARD_ANNUAL_RATE_GBP,
      0
    );
  });
  it("returns null when energy data is missing — and never gives a PHEV either path", () => {
    // EV missing efficiency -> null (no fabricated figure)
    expect(
      deriveRunningCost([{ mpgCombined: null, fuelType: "Electric", powertrain: null, milesPerKwh: null }])
    ).toBeNull();
    // PHEV: weighted MPG is not comparable AND its electric figure alone doesn't cover its
    // real usage mix — excluded from both paths even when it carries milesPerKwh.
    expect(
      deriveRunningCost([{ mpgCombined: 313.9, fuelType: "Hybrid", powertrain: PHEV, milesPerKwh: 3.2 }])
    ).toBeNull();
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
      communityReliability: 50,
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
