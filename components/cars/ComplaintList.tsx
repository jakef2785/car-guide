import { SourceTag } from "@/components/ui/SourceTag";

type Complaint = {
  id: string;
  component: string | null;
  summary: string | null;
  complaintDate: Date | null;
  crashInvolved: boolean | null;
  injuryInvolved: boolean | null;
  dataSource: string;
  dataFetchedAt: Date;
};

const PREVIEW_COUNT = 5;

export function ComplaintList({ complaints }: { complaints: Complaint[] }) {
  if (complaints.length === 0) {
    return <p className="text-sm text-slate-500">No owner complaints on record for this model.</p>;
  }

  const preview = complaints.slice(0, PREVIEW_COUNT);
  const remaining = complaints.length - preview.length;

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        {complaints.length} owner complaint{complaints.length === 1 ? "" : "s"} on record (US-reported
        only, via NHTSA).
      </p>
      <ul className="space-y-3">
        {preview.map((complaint) => (
          <li key={complaint.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{complaint.component ?? "Unspecified component"}</span>
              <SourceTag source={complaint.dataSource} fetchedAt={new Date(complaint.dataFetchedAt)} />
            </div>
            <div className="flex gap-2 text-xs text-slate-400">
              {complaint.complaintDate && (
                <span>{new Date(complaint.complaintDate).toISOString().slice(0, 10)}</span>
              )}
              {complaint.crashInvolved && <span className="text-red-600">Crash involved</span>}
              {complaint.injuryInvolved && <span className="text-red-600">Injury involved</span>}
            </div>
            {complaint.summary && (
              <p className="mt-2 line-clamp-4 text-sm text-slate-700">{complaint.summary}</p>
            )}
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <p className="mt-3 text-sm text-slate-500">+{remaining} more not shown.</p>
      )}
    </div>
  );
}
