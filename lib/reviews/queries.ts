// Server-side review data access. All writes go through the submit/moderation server actions —
// which run these as the trusted path (Prisma, service credentials). Client-side Supabase
// access is separately constrained by RLS + column grants (see 20260707120000 migration).
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REVIEWS_PER_WINDOW, withinRateLimit } from "@/lib/reviews/rate-limit";
import { aggregateReviews, type ReviewAggregate } from "@/lib/reviews/aggregate";

// The most recent submission times for a user — exactly enough rows for the rate-limit check.
// Accepts a transaction client so the check can run under the advisory lock below.
export async function recentReviewTimes(
  userId: string,
  client: Prisma.TransactionClient = prisma,
): Promise<Date[]> {
  const rows = await client.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: REVIEWS_PER_WINDOW,
    select: { createdAt: true },
  });
  return rows.map((r) => r.createdAt);
}

const isSerializationFailure = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  (err.code === "P2034" || /40001|could not serialize/i.test(err.message));

// Atomic rate-limited insert. The 3-per-window cap is a check-then-insert: two concurrent
// submissions from the same user could each read an under-limit count before either commits
// (TOCTOU), defeating the cap. Advisory and row locks do NOT serialise reliably through Supabase's
// transaction pooler (verified empirically — both let all racers through), so we use SERIALIZABLE
// isolation instead. SERIALIZABLE detects the phantom read-then-insert conflict and aborts all but
// one racer with a serialization failure; the loser(s) retry, re-read the now-committed count, and
// either insert or hit the cap. This converges to exactly the cap under concurrency and is
// transaction-pooler-safe (isolation is per-transaction). Different users touch disjoint row
// predicates, so their submissions never conflict — only a single user's own burst serialises.
// Note: each retried conflict is logged by Prisma at error level ("transaction failed to commit");
// under a genuine same-user burst that's expected and handled here, not a bug — it only surfaces
// during the exact abuse this guards against.
export async function insertReviewWithinRateLimit(
  userId: string,
  data: Prisma.ReviewUncheckedCreateInput,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; reason: "rate_limited" | "contention" }> {
  const MAX_ATTEMPTS = 6;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          if (!withinRateLimit(await recentReviewTimes(userId, tx), now)) {
            return { ok: false as const, reason: "rate_limited" as const };
          }
          await tx.review.create({ data });
          return { ok: true as const };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      // A serialization failure is the expected signal of a genuine race — retry with a fresh
      // snapshot. Any other error is real and propagates. A failure on the final attempt falls
      // out of the loop to the fail-closed return below (previously it rethrew, making that
      // return unreachable and turning sustained contention into an unhandled server error).
      if (!isSerializationFailure(err)) throw err;
    }
  }
  // Exhausted retries under sustained contention — fail closed (no insert is the safe direction).
  // Distinct reason from "rate_limited": the user may NOT actually be over the cap, so the caller
  // must not tell them they posted too much — just to try again.
  return { ok: false as const, reason: "contention" as const };
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
