// UK reliability signal — DVSA MOT pass rate + most common failure categories per model.
// Replaces the US-only owner-complaints section for UK data. Every figure source-labelled
// (Guiding-Principles.md). Shows "no data yet" rather than a fabricated score when unseeded.
import { SourceTag } from "@/components/ui/SourceTag";
import { caveatFor } from "@/lib/utils/source-caveats";

type Reliability = {
  id: string;
  ageBand: string | null;
  testCount: number;
  passRate: string | number; // Decimal serialised by the page
  topFailures: string[];
  dataSource: string;
  dataFetchedAt: Date;
};

export function ReliabilityCard({ reliability }: { reliability: Reliability[] }) {
  if (reliability.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No MOT reliability data available yet. (UK MOT outcomes are the reliability signal for this
        guide; the dataset has not been ingested for this model.)
      </p>
    );
  }

  // Prefer the all-ages row; fall back to whatever exists.
  const sorted = [...reliability].sort((a, b) => (a.ageBand === null ? -1 : b.ageBand === null ? 1 : 0));

  return (
    <div className="space-y-4">
      {sorted.map((r) => {
        const pass = typeof r.passRate === "string" ? Number(r.passRate) : r.passRate;
        return (
          <div key={r.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">
                MOT pass rate{r.ageBand ? ` (${r.ageBand})` : ""}
              </span>
              <SourceTag source={r.dataSource} fetchedAt={new Date(r.dataFetchedAt)} />
            </div>
            <p className="text-2xl font-semibold text-slate-900">
              {Number.isFinite(pass) ? `${pass.toFixed(1)}%` : "No data available"}
            </p>
            <p className="text-xs text-slate-400">
              across {r.testCount.toLocaleString("en-GB")} MOT tests
            </p>
            {r.topFailures.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-sm font-medium text-slate-700">Most common failure areas</p>
                <ul className="flex flex-wrap gap-2">
                  {r.topFailures.map((f) => (
                    <li key={f} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="pt-2 text-xs text-slate-400">{caveatFor(r.dataSource)}</p>
          </div>
        );
      })}
    </div>
  );
}
