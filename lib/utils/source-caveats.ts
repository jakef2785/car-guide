// Per-field caveat copy shown next to sourced data, per vault 01-Specification/Data-Sources.md
// and Guiding-Principles.md ("source transparency" — every data point labelled with origin
// and last-updated date). Kept as pure string lookups so they're unit-testable and so any
// future source change (e.g. wiring up VCA per decision 0003) only needs one edit here.
export type SourceKey =
  | "CarVector"
  | "NHTSA"
  | "EPA"
  | "VCA"
  | "VED-computed";

const CAVEATS: Record<SourceKey, string> = {
  CarVector: "US-centric catalogue.",
  NHTSA: "US federal data only.",
  EPA: "US EPA test cycle, converted to UK imperial MPG — not an official UK-certified figure.",
  VCA: "Official WLTP figure.",
  "VED-computed": "Computed from CO2 via GOV.UK bands — confirm current rates at GOV.UK.",
};

export function caveatFor(source: string): string {
  return CAVEATS[source as SourceKey] ?? "Source caveat not documented — verify before relying on this figure.";
}

// Formats a "data_fetched_at" timestamp for the small print under a sourced figure.
// Returns a UTC date (no time) since the pipeline runs are not user-relevant down to the second.
export function formatFetchedAt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Label combining source + last-fetched date, e.g. "CarVector, fetched 2026-06-28".
export function sourceLabel(source: string, fetchedAt: Date): string {
  return `${source}, fetched ${formatFetchedAt(fetchedAt)}`;
}
