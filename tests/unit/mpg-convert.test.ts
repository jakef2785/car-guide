import { roundMpg, ukMpgToUsMpg, usMpgToUkMpg } from "@/lib/utils/mpg-convert";

describe("usMpgToUkMpg / ukMpgToUsMpg", () => {
  it("converts US MPG to a larger UK imperial MPG figure", () => {
    const uk = usMpgToUkMpg(40);
    expect(uk).toBeGreaterThan(40);
    expect(uk).toBeCloseTo(48.04, 1);
  });

  it("round-trips within floating point tolerance", () => {
    const original = 35.7;
    expect(ukMpgToUsMpg(usMpgToUkMpg(original))).toBeCloseTo(original, 6);
  });
});

describe("roundMpg", () => {
  it("rounds to one decimal place", () => {
    expect(roundMpg(40.449)).toBe(40.4);
    expect(roundMpg(40.451)).toBe(40.5);
  });
});
