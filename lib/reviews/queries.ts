// Server-side review data access. All writes go through the submit/moderation server actions —
// which run these as the trusted path (Prisma, service credentials). Client-side Supabase
// access is separately constrained by RLS + column grants (see 20260707120000 migration).
import "server-only";
import { prisma } from "@/lib/prisma";
import { REVIEWS_PER_WINDOW } from "@/lib/reviews/rate-limit";
import { aggregateReviews, type ReviewAggregate } from "@/lib/reviews/aggregate";

// The most recent submission times for a user — exactly enough rows for the rate-limit check.
export async function recentReviewTimes(userId: string): Promise<Date[]> {
  const rows = await prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: REVIEWS_PER_WINDOW,
    select: { createdAt: true },
  });
  return rows.map((r) => r.createdAt);
}

export type ApprovedReview = {
  id: string;
  title: string | null;
  body: string | null;
  knownIssues: string | null;
  variantYear: number | null;
  ownershipMonths: number | null;
  reliabilityRating: number | null;
  runningCostRating: number | null;
  realWorldMpg: string | null;
  createdAt: Date;
  username: string | null;
};

export async function listApprovedReviews(modelId: string): Promise<ApprovedReview[]> {
  const rows = await prisma.review.findMany({
    where: { modelId, isApproved: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      knownIssues: true,
      variantYear: true,
      ownershipMonths: true,
      reliabilityRating: true,
      runningCostRating: true,
      realWorldMpg: true,
      createdAt: true,
      user: { select: { username: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    realWorldMpg: r.realWorldMpg?.toString() ?? null,
    username: r.user?.username ?? null,
  }));
}

export async function approvedReviewAggregate(modelId: string): Promise<ReviewAggregate> {
  const rows = await prisma.review.findMany({
    where: { modelId, isApproved: true },
    select: { reliabilityRating: true, runningCostRating: true },
  });
  return aggregateReviews(rows);
}
