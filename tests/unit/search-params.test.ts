import { parseCarSearchParams, buildModelWhere } from "@/lib/cars/search-params";

describe("parseCarSearchParams", () => {
  it("returns empty object for no params", () => {
    expect(parseCarSearchParams({})).toEqual({});
  });
  it("trims and keeps valid string params", () => {
    expect(parseCarSearchParams({ q: "  CR-V ", fuel: "Petrol", body: "SUV" })).toEqual({
      q: "CR-V",
      fuel: "Petrol",
      body: "SUV",
    });
  });
  it("coerces numeric year params", () => {
    expect(parseCarSearchParams({ yearFrom: "2018", yearTo: "2023" })).toEqual({
      yearFrom: 2018,
      yearTo: 2023,
    });
  });
  it("ignores invalid params instead of throwing", () => {
    expect(parseCarSearchParams({ yearFrom: "banana", q: "" })).toEqual({});
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
  it("matches body at the model level", () => {
    expect(buildModelWhere({ body: "SUV" })).toEqual({
      AND: [{ bodyType: { equals: "SUV", mode: "insensitive" } }],
    });
  });
  it("matches fuel against any variant", () => {
    expect(buildModelWhere({ fuel: "Diesel" })).toEqual({
      AND: [{ variants: { some: { fuelType: { equals: "Diesel", mode: "insensitive" } } } }],
    });
  });
  it("matches a year range against any variant", () => {
    expect(buildModelWhere({ yearFrom: 2018, yearTo: 2022 })).toEqual({
      AND: [{ variants: { some: { year: { gte: 2018, lte: 2022 } } } }],
    });
  });
  it("combines fuel and year into one variant clause", () => {
    expect(buildModelWhere({ fuel: "Hybrid", yearFrom: 2020 })).toEqual({
      AND: [
        { variants: { some: { fuelType: { equals: "Hybrid", mode: "insensitive" }, year: { gte: 2020 } } } },
      ],
    });
  });
});
