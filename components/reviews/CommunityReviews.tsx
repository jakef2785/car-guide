// Community reviews section — deliberately visually distinct from sourced-data sections
// (Phase-4-Design.md / Guiding-Principles.md: community opinion must never read as sourced fact).
import Link from "next/link";
import { caveatFor } from "@/lib/utils/source-caveats";
import type { ReviewAggregate } from "@/lib/reviews/aggregate";
import type { ApprovedReview } from "@/lib/reviews/queries";

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5`} className="text-amber-500">
      {"★".repeat(rating)}
      <span className="text-slate-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function CommunityReviews({
  reviews,
  aggregate,
  writeHref,
  justSubmitted,
}: {
  reviews: ApprovedReview[];
  aggregate: ReviewAggregate;
  writeHref: string;
  justSubmitted: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          title={caveatFor("Community")}
          className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
        >
          Community — owner opinions, not sourced data
        </span>
        <Link
          href={writeHref}
          className="rounded-md bg-charcoal px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Write a review
        </Link>
      </div>

      {justSubmitted && (
        <p role="status" className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Thanks — your review has been submitted and will appear once a moderator approves it.
        </p>
      )}

      {aggregate.count > 0 ? (
        <p className="mt-3 text-sm text-slate-700">
          {aggregate.count} approved review{aggregate.count === 1 ? "" : "s"}
          {aggregate.avgReliability != null && <> · reliability {aggregate.avgReliability}/5</>}
          {aggregate.avgRunningCost != null && <> · running costs {aggregate.avgRunningCost}/5</>}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No community reviews yet — owned one? Be the first.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-4">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-gray-900">{r.title}</h3>
              <span className="text-xs text-slate-600">
                {r.username ?? "CarGuide member"} · {r.createdAt.toISOString().slice(0, 10)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {r.reliabilityRating != null && (
                <>
                  Reliability <Stars rating={r.reliabilityRating} />{" "}
                </>
              )}
              {r.runningCostRating != null && (
                <>
                  · Running costs <Stars rating={r.runningCostRating} />
                </>
              )}
              {r.variantYear && <> · {r.variantYear}</>}
              {r.ownershipMonths != null && <> · owned {r.ownershipMonths} months</>}
              {r.realWorldMpg && <> · {r.realWorldMpg} MPG real-world</>}
            </p>
            {r.body && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.body}</p>}
            {r.knownIssues && (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-medium">Known issues:</span> {r.knownIssues}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
