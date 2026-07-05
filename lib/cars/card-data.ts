// Pure display helpers for car listing cards. Kept free of Prisma/runtime deps so they're
// unit-testable and reusable across pages.
//
// No year helpers here: the VCA catalogue is the current on-sale set with no real per-variant
// model year, so cards never show a (misleading) year. Real model years live in MOT reliability.

// A representative variant for the card's one-line spec summary. Prefer one that actually carries
// fuel-economy data (most informative); fall back to the first.
export function representativeVariant<T extends { mpgCombined: string | null }>(variants: T[]): T | null {
  if (variants.length === 0) return null;
  return variants.find((v) => v.mpgCombined !== null) ?? variants[0];
}

export function trimCountLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 trim" : `${count} trims`;
}

export function recallCountLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 recall" : `${count} recalls`;
}
