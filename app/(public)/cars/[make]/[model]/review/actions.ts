"use server";

// Review submission — the gates are all load-bearing (Phase-4-Design.md):
// signed in → email verified → Zod parse → model exists → atomic rate-limit + insert unapproved.
// The rate-limit check is fused with the insert (insertReviewWithinRateLimit) so it can't be
// beaten by concurrent requests; validation runs first so we don't take a lock for junk input.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth/user";
import { reviewSchema } from "@/lib/reviews/validation";
import { insertReviewWithinRateLimit } from "@/lib/reviews/queries";

export type ReviewFormState = { error: string | null };

export async function submitReviewAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const user = await getUser();
  if (!user) return { error: "Sign in to post a review." };
  if (!user.email_confirmed_at)
    return { error: "Verify your email before posting a review — check your inbox." };

  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  // Resolve the model server-side: confirms the posted id is real and gives us trusted slugs
  // for the redirect (never redirect to client-supplied paths).
  const model = await prisma.model.findUnique({
    where: { id: parsed.data.modelId },
    select: { slug: true, make: { select: { slug: true } } },
  });
  if (!model?.make) return { error: "Unknown model — reload the page and try again." };

  const { modelId, ...fields } = parsed.data;
  const result = await insertReviewWithinRateLimit(user.id, {
    userId: user.id, // from the session, never from the form
    modelId,
    ...fields,
    // isApproved defaults false — every review goes through moderation.
  });
  if (!result.ok)
    return { error: "You've posted several reviews recently — try again in an hour." };

  redirect(`/cars/${model.make.slug}/${model.slug}?reviewed=1`);
}
