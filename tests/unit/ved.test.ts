import { calculateFirstYearVed, categorizeFuelType } from "@/lib/data-pipeline/ved";

describe("categorizeFuelType", () => {
  it("maps known free-text fuel types to banding categories", () => {
    expect(categorizeFuelType("Gasoline")).toBe("petrol");
    expect(categorizeFuelType("Electric")).toBe("electric");
    expect(categorizeFuelType("Diesel")).toBe("diesel");
    expect(categorizeFuelType("Hybrid")).toBe("alternative");
  });

  it("falls back to petrol for unmapped or missing values", () => {
    expect(categorizeFuelType("Hydrogen Fuel Cell")).toBe("petrol");
    expect(categorizeFuelType(null)).toBe("petrol");
    expect(categorizeFuelType(undefined)).toBe("petrol");
  });
});

describe("calculateFirstYearVed", () => {
  it("returns the zero-emission band rate for an EV with 0 g/km", () => {
    const result = calculateFirstYearVed(0, "Electric");
    expect(result).toEqual({ firstYearRateGbp: 10, assumptionApplied: false });
  });

  it("applies the standard (non-diesel) band rate for a petrol car", () => {
    const result = calculateFirstYearVed(165, "Gasoline");
    expect(result).toEqual({ firstYearRateGbp: 1410, assumptionApplied: false });
  });

  it("applies the diesel surcharge band and flags the RDE2 assumption", () => {
    const result = calculateFirstYearVed(165, "Diesel");
    expect(result).toEqual({ firstYearRateGbp: 2270, assumptionApplied: true });
  });

  it("falls back to the top band for CO2 above the highest threshold", () => {
    const result = calculateFirstYearVed(400, "Gasoline");
    expect(result.firstYearRateGbp).toBe(5690);
  });

  it("treats a null/undefined CO2 as 0 g/km (zero-emission band)", () => {
    expect(calculateFirstYearVed(null, "Gasoline").firstYearRateGbp).toBe(10);
    expect(calculateFirstYearVed(undefined, "Gasoline").firstYearRateGbp).toBe(10);
  });
});
