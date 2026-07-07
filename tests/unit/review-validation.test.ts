import { reviewSchema } from "@/lib/reviews/validation";

// A minimal payload that should pass — everything else is variations on this.
const valid = {
  modelId: "9f8b7c6d-1e2f-4a3b-8c9d-0a1b2c3d4e5f",
  reliabilityRating: 4,
  runningCostRating: 3,
  title: "Solid daily driver",
  body: "Owned for two years and it has been dependable in all weather, cheap to service and comfortable on the motorway.",
};

describe("reviewSchema", () => {
  it("accepts a minimal valid review", () => {
    const parsed = reviewSchema.parse(valid);
    expect(parsed.modelId).toBe(valid.modelId);
    expect(parsed.reliabilityRating).toBe(4);
  });

  it("accepts a fully-populated review and coerces form-data strings to numbers", () => {
    const parsed = reviewSchema.parse({
      ...valid,
      reliabilityRating: "5",
      runningCostRating: "2",
      variantYear: "2019",
      ownershipMonths: "36",
      annualMileage: "9000",
      realWorldMpg: "47.3",
      monthlyFuelCostGbp: "120",
      monthlyInsuranceGbp: "45.50",
      annualServicingGbp: "300",
      knownIssues: "Rear washer jet blocked twice.",
    });
    expect(parsed.variantYear).toBe(2019);
    expect(parsed.ownershipMonths).toBe(36);
    expect(parsed.realWorldMpg).toBeCloseTo(47.3);
    expect(parsed.monthlyInsuranceGbp).toBeCloseTo(45.5);
  });

  it("rejects a missing or malformed modelId", () => {
    expect(reviewSchema.safeParse({ ...valid, modelId: undefined }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, modelId: "not-a-uuid" }).success).toBe(false);
  });

  it("requires both ratings and bounds them to 1-5 integers", () => {
    expect(reviewSchema.safeParse({ ...valid, reliabilityRating: undefined }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, runningCostRating: undefined }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, reliabilityRating: 0 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, reliabilityRating: 6 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, reliabilityRating: 3.5 }).success).toBe(false);
  });

  it("bounds title and body length and trims whitespace", () => {
    expect(reviewSchema.safeParse({ ...valid, title: "Hi" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, title: "x".repeat(101) }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, body: "Too short." }).success).toBe(false);
    const parsed = reviewSchema.parse({ ...valid, title: `  ${valid.title}  ` });
    expect(parsed.title).toBe(valid.title);
  });

  it("treats empty-string optional fields from form data as absent", () => {
    const parsed = reviewSchema.parse({
      ...valid,
      variantYear: "",
      realWorldMpg: "",
      knownIssues: "",
    });
    expect(parsed.variantYear).toBeUndefined();
    expect(parsed.realWorldMpg).toBeUndefined();
    expect(parsed.knownIssues).toBeUndefined();
  });

  it("rejects out-of-range optional numerics", () => {
    expect(reviewSchema.safeParse({ ...valid, variantYear: 1899 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, annualMileage: -1 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, realWorldMpg: 400 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, ownershipMonths: 1200 }).success).toBe(false);
  });

  it("never accepts moderation fields from the client", () => {
    // Even if a client posts is_approved, the parsed output must not carry it through.
    const parsed = reviewSchema.parse({ ...valid, isApproved: true, is_approved: true });
    expect(parsed).not.toHaveProperty("isApproved");
    expect(parsed).not.toHaveProperty("is_approved");
  });
});
