// Picks, per target model, the single richest donor to migrate stale enrichment data from —
// used when the catalogue seed renames/merges a model and its MOT reliability / recall rows need
// to move to the successor instead of being cascade-deleted with the stale row.
//
// Each criterion (reliability, recalls) MUST call this separately, with counts specific to that
// criterion. Reusing one sort order across criteria would let a donor win a criterion's migration
// purely because it happened to have more rows of a DIFFERENT criterion — silently dropping the
// actually-larger dataset for the criterion in question when a stale model is pruned.

export type EnrichmentDonor = {
  staleId: string;
  targetId: string | null;
  count: number; // this criterion's row count for staleId
};

export type EnrichmentMove = { staleId: string; targetId: string };

export function planEnrichmentMoves(
  donors: EnrichmentDonor[],
  targetsAlreadyFilled: Iterable<string>
): EnrichmentMove[] {
  const filled = new Set(targetsAlreadyFilled);
  const byTarget = new Map<string, EnrichmentDonor[]>();

  for (const d of donors) {
    if (!d.targetId || d.targetId === d.staleId || d.count <= 0) continue;
    if (!byTarget.has(d.targetId)) byTarget.set(d.targetId, []);
    byTarget.get(d.targetId)!.push(d);
  }

  const moves: EnrichmentMove[] = [];
  for (const [targetId, candidates] of Array.from(byTarget)) {
    if (filled.has(targetId)) continue;
    const winner = candidates.reduce((best: EnrichmentDonor, d: EnrichmentDonor) => (d.count > best.count ? d : best));
    moves.push({ staleId: winner.staleId, targetId });
  }
  return moves;
}
