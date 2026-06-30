"use client";

// UK reliability signal — MOT faults per 100 tests, filterable BY MODEL YEAR, because some model
// years are far better or worse than others. Source: UK MOT outcomes (DVSA data) via motsearch.
// Lower is better. Replaces US owner-complaints. Honest empty state when a model has no MOT history
// (e.g. a brand-new or EV-only model). Every figure source-labelled (Guiding-Principles.md).
import { useState } from "react";
import { SourceTag } from "@/components/ui/SourceTag";
import { caveatFor } from "@/lib/utils/source-caveats";

type Reliability = {
  id: string;
  ageBand: string | null; // model year, e.g. "2015"
  defectsPer100: string | number | null;
  yearAvgPer100: string | number | null;
  testCount: number | null;
  sampleCars: number | null;
  topFailures: string[];
  dataSource: string;
  dataFetchedAt: Date;
};

function toNum(v: string | number | null): number | null {
  if (v === null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function delta(model: number, avg: number) {
  const pct = ((model - avg) / avg) * 100;
  const rounded = Math.round(Math.abs(pct));
  if (Math.abs(pct) <= 5) return { text: "~ average", cls: "bg-amber-100 text-amber-800" };
  if (pct < 0) return { text: `${rounded}% better than average`, cls: "bg-green-100 text-green-800" };
  return { text: `${rounded}% worse than average`, cls: "bg-red-100 text-red-800" };
}

export function ReliabilityCard({ reliability }: { reliability: Reliability[] }) {
  const years = [...reliability]
    .filter((r) => r.ageBand)
    .sort((a, b) => Number(b.ageBand) - Number(a.ageBand));

  const [selected, setSelected] = useState<string>(years[0]?.ageBand ?? "");

  if (years.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No MOT reliability data available yet — there is no MOT history for this model (e.g. a new or
        electric-only model that has not yet reached its first MOT). UK MOT outcomes are this
        guide&rsquo;s reliability signal.
      </p>
    );
  }

  const row = years.find((r) => r.ageBand === selected) ?? years[0];
  const model = toNum(row.defectsPer100);
  const avg = toNum(row.yearAvgPer100);
  const badge = model !== null && avg !== null && avg > 0 ? delta(model, avg) : null;

  // Best / worst year, for at-a-glance context across years.
  const rated = years
    .map((r) => ({ year: r.ageBand!, m: toNum(r.defectsPer100), a: toNum(r.yearAvgPer100) }))
    .filter((r) => r.m !== null && r.a !== null && r.a! > 0)
    .map((r) => ({ year: r.year, rel: (r.m! - r.a!) / r.a! }));
  const best = rated.reduce<(typeof rated)[number] | null>((b, r) => (!b || r.rel < b.rel ? r : b), null);
  const worst = rated.reduce<(typeof rated)[number] | null>((w, r) => (!w || r.rel > w.rel ? r : w), null);

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Model year
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-normal text-slate-900"
          >
            {years.map((r) => (
              <option key={r.id} value={r.ageBand!}>
                {r.ageBand}
              </option>
            ))}
          </select>
        </label>
        <SourceTag source={row.dataSource} fetchedAt={new Date(row.dataFetchedAt)} />
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-900">
          {model !== null ? model.toFixed(0) : "—"}
        </span>
        <span className="text-sm text-slate-500">faults per 100 MOT tests</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        {avg !== null && <span>Average for a {row.ageBand} car: {avg.toFixed(0)}</span>}
        {badge && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.text}</span>}
      </div>
      {(row.testCount !== null || row.sampleCars !== null) && (
        <p className="mt-1 text-xs text-slate-400">
          {row.sampleCars !== null && `${row.sampleCars.toLocaleString("en-GB")} cars`}
          {row.sampleCars !== null && row.testCount !== null && " · "}
          {row.testCount !== null && `${row.testCount.toLocaleString("en-GB")} tests`}
        </p>
      )}

      {row.topFailures.length > 0 ? (
        <div className="mt-4">
          <p className="mb-1 text-sm font-medium text-slate-700">Most common faults ({row.ageBand})</p>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-600">
            {row.topFailures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">Per-fault detail for this year is still being collected.</p>
      )}

      {best && worst && best.year !== worst.year && (
        <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
          Across all years on record, <span className="font-medium text-green-700">{best.year}</span> is the
          strongest and <span className="font-medium text-red-700">{worst.year}</span> the weakest relative to
          its year&rsquo;s average.
        </p>
      )}

      <p className="pt-3 text-xs text-slate-400">{caveatFor(row.dataSource)}</p>
    </div>
  );
}
