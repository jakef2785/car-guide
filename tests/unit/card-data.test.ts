import { representativeVariant, yearRange, recallCountLabel } from "@/lib/cars/card-data";

describe("representativeVariant", () => {
  it("returns null for no variants", () => {
    expect(representativeVariant([])).toBeNull();
  });
  it("returns the latest-year variant", () => {
    const v = representativeVariant([{ year: 2019 }, { year: 2023 }, { year: 2021 }]);
    expect(v).toEqual({ year: 2023 });
  });
});

describe("yearRange", () => {
  it("returns null for no variants", () => {
    expect(yearRange([])).toBeNull();
  });
  it("returns a single year when min === max", () => {
    expect(yearRange([{ year: 2020 }])).toBe("2020");
  });
  it("returns an en-dashed range", () => {
    expect(yearRange([{ year: 2019 }, { year: 2023 }])).toBe("2019–2023");
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
