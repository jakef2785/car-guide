import { parseCarSearchParams, buildModelWhere } from "@/lib/cars/search-params";

describe("parseCarSearchParams", () => {
  it("returns empty object for no params", () => {
    expect(parseCarSearchParams({})).toEqual({});
  });
  it("trims and keeps valid string params", () => {
    expect(parseCarSearchParams({ q: "  Golf ", make: "Volkswagen", fuel: "Petrol", transmission: "Manual", body: "SUV" })).toEqual({
      q: "Golf",
      make: "Volkswagen",
      fuel: "Petrol",
      transmission: "Manual",
      body: "SUV",
    });
  });
  it("coerces numeric range params", () => {
    expect(parseCarSearchParams({ engineFrom: "1000", engineTo: "2000", powerFrom: "90", powerTo: "300", mpgMin: "40", co2Max: "120" })).toEqual({
      engineFrom: 1000,
      engineTo: 2000,
      powerFrom: 90,
      powerTo: 300,
      mpgMin: 40,
      co2Max: 120,
    });
  });
  it("accepts the reliability and sort enums, ignoring bogus values", () => {
    expect(parseCarSearchParams({ reliability: "better", sort: "mpg" })).toEqual({ reliability: "better", sort: "mpg" });
    expect(parseCarSearchParams({ reliability: "nonsense", sort: "sideways" })).toEqual({});
  });
  it("ignores invalid params instead of throwing", () => {
    expect(parseCarSearchParams({ engineFrom: "banana", q: "" })).toEqual({});
  });
  it("treats empty-string numeric params as absent, not zero (the filter form submits every field)", () => {
    // A plain GET form sends ?fuel=Petrol&engineTo=&co2Max=... — the empty numerics must not
    // become 0 (engineTo=0 / co2Max=0 would exclude every car with data).
    expect(
      parseCarSearchParams({
        q: "",
        make: "",
        fuel: "Petrol",
        transmission: "",
        engineFrom: "",
        engineTo: "",
        powerFrom: "",
        powerTo: "",
        mpgMin: "",
        co2Max: "",
        sort: "",
      })
    ).toEqual({ fuel: "Petrol" });
  });
  it("treats whitespace-only numeric params as absent", () => {
    expect(parseCarSearchParams({ co2Max: "  " })).toEqual({});
  });
  it("still accepts a genuine zero", () => {
    expect(parseCarSearchParams({ co2Max: "0" })).toEqual({ co2Max: 0 });
  });
  it("takes the first value when given an array", () => {
    expect(parseCarSearchParams({ q: ["a", "b"] })).toEqual({ q: "a" });
  });
});

describe("buildModelWhere", () => {
  it("returns {} for no params", () => {
    expect(buildModelWhere({})).toEqual({});
  });
  it("matches q against model name and make name", () => {
    expect(buildModelWhere({ q: "civic" })).toEqual({
      AND: [
        {
          OR: [
            { name: { contains: "civic", mode: "insensitive" } },
            { make: { name: { contains: "civic", mode: "insensitive" } } },
          ],
        },
      ],
    });
  });
  it("matches make at the make level and body at the model level", () => {
    expect(buildModelWhere({ make: "Ford" })).toEqual({
      AND: [{ make: { name: { equals: "Ford", mode: "insensitive" } } }],
    });
    expect(buildModelWhere({ body: "SUV" })).toEqual({
      AND: [{ bodyType: { equals: "SUV", mode: "insensitive" } }],
    });
  });
  it("matches fuel against any variant", () => {
    expect(buildModelWhere({ fuel: "Diesel" })).toEqual({
      AND: [{ variants: { some: { fuelType: { equals: "Diesel", mode: "insensitive" } } } }],
    });
  });
  it("folds engine/power ranges and mpg/co2 into one variant clause", () => {
    expect(buildModelWhere({ engineFrom: 1000, engineTo: 2000, powerFrom: 100, mpgMin: 45, co2Max: 120 })).toEqual({
      AND: [
        {
          variants: {
            some: {
              engineSizeCc: { gte: 1000, lte: 2000 },
              horsepower: { gte: 100 },
              mpgCombined: { gte: 45 },
              co2Gkm: { lte: 120 },
            },
          },
        },
      ],
    });
  });
  it("combines make (model-level) and fuel (variant-level) into separate AND clauses", () => {
    expect(buildModelWhere({ make: "Kia", fuel: "Hybrid" })).toEqual({
      AND: [
        { make: { name: { equals: "Kia", mode: "insensitive" } } },
        { variants: { some: { fuelType: { equals: "Hybrid", mode: "insensitive" } } } },
      ],
    });
  });
});

describe("parseCarSearchParams — page", () => {
  it("accepts an integer page of 2 or more", () => {
    expect(parseCarSearchParams({ page: "3" }).page).toBe(3);
  });
  it("treats page 1, non-integers and junk as absent (page 1)", () => {
    expect(parseCarSearchParams({ page: "1" }).page).toBeUndefined();
    expect(parseCarSearchParams({ page: "0" }).page).toBeUndefined();
    expect(parseCarSearchParams({ page: "2.5" }).page).toBeUndefined();
    expect(parseCarSearchParams({ page: "-4" }).page).toBeUndefined();
    expect(parseCarSearchParams({ page: "banana" }).page).toBeUndefined();
    expect(parseCarSearchParams({ page: "" }).page).toBeUndefined();
    expect(parseCarSearchParams({}).page).toBeUndefined();
  });
});
