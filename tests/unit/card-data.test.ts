import { representativeVariant, trimCountLabel, recallCountLabel } from "@/lib/cars/card-data";

describe("representativeVariant", () => {
  it("returns null for no variants", () => {
    expect(representativeVariant([])).toBeNull();
  });
  it("prefers a variant that has fuel-economy data", () => {
    const v = representativeVariant([
      { mpgCombined: null },
      { mpgCombined: "48.7" },
    ]);
    expect(v).toEqual({ mpgCombined: "48.7" });
  });
  it("falls back to the first variant when none have mpg", () => {
    expect(representativeVariant([{ mpgCombined: null }, { mpgCombined: null }])).toEqual({ mpgCombined: null });
  });
});

describe("trimCountLabel", () => {
  it("returns null for zero or negative", () => {
    expect(trimCountLabel(0)).toBeNull();
    expect(trimCountLabel(-1)).toBeNull();
  });
  it("singular and plural", () => {
    expect(trimCountLabel(1)).toBe("1 trim");
    expect(trimCountLabel(6)).toBe("6 trims");
  });
});

describe("recallCountLabel", () => {
  it("returns null for zero or negative", () => {
    expect(recallCountLabel(0)).toBeNull();
    expect(recallCountLabel(-1)).toBeNull();
  });
  it("singular and plural", () => {
    expect(recallCountLabel(1)).toBe("1 recall");
    expect(recallCountLabel(3)).toBe("3 recalls");
  });
});
