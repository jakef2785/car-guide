import type { Metadata } from "next";
import { scoreModels, CRITERION_KEYS } from "@/lib/scoring/weighted-score";
import { parseWeights, CRITERION_LABELS, CRITERION_SOURCES } from "@/lib/scoring/score-params";
import { fetchScoringInputs, RUNNING_COST_ASSUMPTIONS } from "@/lib/scoring/criteria-data";
import { WeightSlider } from "@/components/score/WeightSlider";
import { ScoreCard } from "@/components/score/ScoreCard";

export const metadata: Metadata = {
  title: "Score cars by your priorities",
  description:
    "Weight performance, economy, running cost, MOT reliability and recalls — get a transparent ranked list where every number traces to a source.",
};

const SHOW_TOP = 50;

export default async function ScorePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const weights = parseWeights(searchParams);
  const inputs = await fetchScoringInputs();

  const scored = scoreModels(
    inputs.map((m) => ({ id: m.id, values: m.values })),
    weights
  );
  const byId = new Map(inputs.map((m) => [m.id, m]));
  const ranked = scored.filter((s) => s.finalScore !== null);
  const shown = ranked.slice(0, SHOW_TOP);
  const allZero = CRITERION_KEYS.every((k) => weights[k] === 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Score cars by your priorities</h1>
      <p className="mb-6 max-w-2xl text-sm text-gray-500">
        Set how much each criterion matters to you. Scores are relative to the cars compared (0–100 per
        criterion), weighted by your sliders. Models missing data on a criterion have it excluded — never
        counted as zero.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        <aside className="self-start rounded-xl border border-gray-200 bg-white p-5 md:sticky md:top-4">
          <h2 className="mb-4 text-base font-bold text-gray-900">Your priorities</h2>
          <form method="get" className="space-y-5">
            {CRITERION_KEYS.map((key) => (
              <WeightSlider
                key={key}
                name={key}
                label={CRITERION_LABELS[key]}
                source={CRITERION_SOURCES[key]}
                defaultValue={weights[key]}
              />
            ))}
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Rank cars
            </button>
          </form>
          <p className="mt-4 text-xs text-gray-500">
            Running cost assumes {RUNNING_COST_ASSUMPTIONS.annualMiles.toLocaleString()} miles/year at £
            {RUNNING_COST_ASSUMPTIONS.petrolPricePerLitre.toFixed(2)}/L petrol · £
            {RUNNING_COST_ASSUMPTIONS.dieselPricePerLitre.toFixed(2)}/L diesel, plus first-year VED. EVs are
            not scored on running cost (no electricity-cost data), and plug-in hybrids&apos; weighted-test MPG
            (a different WLTP regime producing 150+ &quot;mpg&quot;) is excluded from economy and running-cost
            scoring as not comparable. Recall history currently has no data for any model — the DVSA recalls
            feed is pending.
          </p>
        </aside>

        <section>
          {allZero ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <p className="text-gray-900">All weights are zero — move a slider to rank cars.</p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-gray-500">
                Showing top {Math.min(SHOW_TOP, ranked.length)} of {ranked.length} scoreable models
                {ranked.length < scored.length &&
                  ` (${scored.length - ranked.length} more have no data on any chosen criterion)`}
                .
              </p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {shown.map((s, i) => (
                  <ScoreCard key={s.id} rank={i + 1} model={byId.get(s.id)!} scored={s} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
