import { SourceTag } from "@/components/ui/SourceTag";

type Recall = {
  id: string;
  campaignRef: string | null;
  component: string | null;
  summary: string | null;
  consequence: string | null;
  remedy: string | null;
  recallDate: Date | null;
  dataSource: string;
  dataFetchedAt: Date;
};

export function RecallList({ recalls }: { recalls: Recall[] }) {
  if (recalls.length === 0) {
    return <p className="text-sm text-slate-500">No recalls on record for this model.</p>;
  }

  return (
    <ul className="space-y-3">
      {recalls.map((recall) => (
        <li key={recall.id} className="rounded-lg border border-slate-200 p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium text-slate-900">
              {recall.component ?? "Unspecified component"}
              {recall.campaignRef ? ` — Campaign ${recall.campaignRef}` : ""}
            </span>
            <SourceTag source={recall.dataSource} fetchedAt={new Date(recall.dataFetchedAt)} />
          </div>
          {recall.recallDate && (
            <p className="text-xs text-slate-400">
              {new Date(recall.recallDate).toISOString().slice(0, 10)}
            </p>
          )}
          {recall.summary && <p className="mt-2 text-sm text-slate-700">{recall.summary}</p>}
          {recall.consequence && (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-medium">Consequence: </span>
              {recall.consequence}
            </p>
          )}
          {recall.remedy && (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-medium">Remedy: </span>
              {recall.remedy}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
