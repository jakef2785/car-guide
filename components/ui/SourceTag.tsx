// Small badge showing where a data point came from and when it was fetched, plus its caveat
// on hover/title. Per Guiding-Principles.md: every data point must be source-labelled.
import { caveatFor, sourceLabel } from "@/lib/utils/source-caveats";

export function SourceTag({ source, fetchedAt }: { source: string; fetchedAt: Date }) {
  return (
    <span
      title={caveatFor(source)}
      className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
    >
      {sourceLabel(source, fetchedAt)}
    </span>
  );
}
