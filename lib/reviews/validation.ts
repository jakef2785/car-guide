// Shared review-submission schema — imported by BOTH the client form (UX feedback) and the
// server action (security). Per Security-Requirements.md the two validations are independent
// runs, but sharing one schema keeps them from drifting apart.
import { z } from "zod";

const CURRENT_YEAR = new Date().getFullYear();

// Form data arrives as strings and blank inputs arrive as "" — treat blank as absent so
// optional numeric fields don't coerce "" to 0.
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalInt = (min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).max(max).optional());

const optionalDecimal = (min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().min(min).max(max).optional());

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

const rating = z.coerce.number().int().min(1).max(5);

// Moderation fields (is_approved etc.) are deliberately absent: z.object strips unknown keys,
// so a client posting them gets them silently dropped — and the DB grants block them anyway.
export const reviewSchema = z.object({
  modelId: z.string().uuid(),
  reliabilityRating: rating,
  runningCostRating: rating,
  title: z.string().trim().min(5).max(100),
  body: z.string().trim().min(30).max(5000),
  knownIssues: optionalText(2000),
  variantYear: optionalInt(1980, CURRENT_YEAR + 1),
  ownershipMonths: optionalInt(0, 600),
  annualMileage: optionalInt(0, 200_000),
  realWorldMpg: optionalDecimal(1, 300),
  monthlyFuelCostGbp: optionalDecimal(0, 5000),
  monthlyInsuranceGbp: optionalDecimal(0, 5000),
  annualServicingGbp: optionalDecimal(0, 20_000),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
