// Review submission page. Auth-aware: prompts sign-in / email verification before showing the
// form; the server action re-checks both regardless (defence-in-depth).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth/user";
import { ReviewForm } from "@/components/reviews/ReviewForm";

const paramsSchema = z.object({
  make: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  model: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export const metadata: Metadata = { title: "Write a review" };

export default async function ReviewPage({
  params,
}: {
  params: { make: string; model: string };
}) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) notFound();

  const model = await prisma.model.findFirst({
    where: { slug: parsed.data.model, make: { slug: parsed.data.make } },
    select: { id: true, name: true, make: { select: { name: true, slug: true } } },
  });
  if (!model?.make) notFound();

  const user = await getUser();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm">
        <Link href={`/cars/${parsed.data.make}/${parsed.data.model}`} className="text-slate-500 hover:underline">
          ← Back to {model.make.name} {model.name}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">
        Review the {model.make.name} {model.name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Owner experience only — sourced specs and reliability data stay separate from community
        reviews.
      </p>

      {!user ? (
        <p className="mt-8 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <Link href="/login" className="font-semibold underline">
            Sign in
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="font-semibold underline">
            create an account
          </Link>{" "}
          to write a review.
        </p>
      ) : !user.email_confirmed_at ? (
        <p className="mt-8 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Verify your email before posting a review — check your inbox for the verification link.
        </p>
      ) : (
        <ReviewForm modelId={model.id} />
      )}
    </main>
  );
}
