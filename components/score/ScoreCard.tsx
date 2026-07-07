// One ranked result on /score: final score, per-criterion breakdown with contribution, and the
// criteria we could NOT score labelled "No data available" (never silently zeroed).
import Link from "next/link";
import { CRITERION_KEYS, type CriterionKey, type ScoredModel } from "@/lib/scoring/weighted-score";
import { CRITERION_LABELS } from "@/lib/scoring/score-params";
import type { ScoringInput } from "@/lib/scoring/criteria-data";

function fmtRaw(key: CriterionKey, raw: number): string {
  switch (key) {
    case "performance":
      return `${Math.round(raw)} ps`;
    case "economy":
      return `${raw.toFixed(1)} mpg`;
    case "runningCost":
      return `£${Math.round(raw)}/yr`;
    case "reliability":
      return `${Math.round(raw * 100)}% of year avg`;
    case "recalls":
      return `${Math.round(raw)} recall${raw === 1 ? "" : "s"}`;
    case "communityReliability":
      return `${raw.toFixed(1)}/5 owner rating`;
  }
}

export function ScoreCard({
  rank,
  model,
  scored,
}: {
  rank: number;
  model: ScoringInput;
  scored: ScoredModel<string>;
}) {
  const active = CRITERION_KEYS.filter((k) => scored.criteria[k].weight > 0);

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">#{rank}</p>
          <h3 className="text-lg font-bold text-gray-900">
            <Link href={`/cars/${model.makeSlug}/${model.modelSlug}`} className="hover:text-blue-700">
              {model.makeName} {model.modelName}
            </Link>
          </h3>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums text-gray-900">
            {scored.finalScore === null ? "—" : Math.round(scored.finalScore)}
          </p>
          <p className="text-xs text-gray-500">weighted score</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {active.map((key) => {
          const c = scored.criteria[key];
          return (
            <li key={key} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-gray-700">{CRITERION_LABELS[key]}</span>
                <span className="tabular-nums text-gray-500">
                  {c.score === null ? (
                    <span className="italic">No data available</span>
                  ) : (
                    <>
                      {fmtRaw(key, c.raw!)} · score {Math.round(c.score)} · +{c.contribution!.toFixed(1)}
                    </>
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-gray-100">
                {c.score !== null && (
                  <div className="h-full rounded bg-blue-600" style={{ width: `${Math.max(2, c.score)}%` }} />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {scored.missing.length > 0 && scored.finalScore !== null && (
        <p className="mt-3 text-xs text-gray-500">
          Score based on {active.length - scored.missing.length} of {active.length} chosen criteria — the rest
          have no data for this model and were left out (not counted as zero).
        </p>
      )}
    </article>
  );
}
