// Moderation queue — pending (unapproved) reviews, oldest first so nothing rots at the back.
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { approveReviewAction, rejectReviewAction } from "./actions";

export const metadata: Metadata = { title: "Review moderation" };

export default async function AdminReviewsPage() {
  const pending = await prisma.review.findMany({
    where: { isApproved: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      body: true,
      knownIssues: true,
      variantYear: true,
      reliabilityRating: true,
      runningCostRating: true,
      createdAt: true,
      user: { select: { username: true, id: true } },
      model: { select: { name: true, make: { select: { name: true } } } },
    },
  });

  return (
    <main>
      <h1 className="text-2xl font-bold text-gray-900">Review moderation</h1>
      <p className="mt-1 text-sm text-slate-500">
        {pending.length === 0
          ? "Queue is empty — nothing awaiting approval."
          : `${pending.length} review${pending.length === 1 ? "" : "s"} awaiting approval, oldest first.`}
      </p>

      <ul className="mt-6 flex flex-col gap-4">
        {pending.map((r) => (
          <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-gray-900">
                {r.model?.make?.name} {r.model?.name}
                {r.variantYear && ` (${r.variantYear})`} — {r.title}
              </h2>
              <span className="text-xs text-slate-400">
                {r.user?.username ?? r.user?.id ?? "unknown user"} ·{" "}
                {r.createdAt.toISOString().slice(0, 10)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Reliability {r.reliabilityRating ?? "—"}/5 · Running costs {r.runningCostRating ?? "—"}/5
            </p>
            {r.body && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.body}</p>}
            {r.knownIssues && (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-medium">Known issues:</span> {r.knownIssues}
              </p>
            )}

            <div className="mt-4 flex gap-3">
              <form action={approveReviewAction}>
                <input type="hidden" name="reviewId" value={r.id} />
                <button
                  type="submit"
                  className="rounded-md bg-green-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-800"
                >
                  Approve
                </button>
              </form>
              <form action={rejectReviewAction}>
                <input type="hidden" name="reviewId" value={r.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Reject &amp; delete
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
