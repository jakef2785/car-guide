// Small badge showing where a data point came from and when it was fetched, plus its caveat.
// Per Guiding-Principles.md: every data point must be source-labelled. The caveat lives in
// title= for pointer users AND as visually-hidden text so screen readers announce it — title
// alone is invisible to keyboard and assistive tech.
import { caveatFor, sourceLabel } from "@/lib/utils/source-caveats";

export function SourceTag({ source, fetchedAt }: { source: string; fetchedAt: Date }) {
  return (
    <span
      title={caveatFor(source)}
      className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
    >
      {sourceLabel(source, fetchedAt)}
      <span className="sr-only"> — {caveatFor(source)}</span>
    </span>
  );
}
