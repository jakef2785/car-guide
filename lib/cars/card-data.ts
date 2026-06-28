// Pure display helpers for car listing cards. Kept free of Prisma/runtime deps so they're
// unit-testable and reusable across pages. See vault 02-Phases/Phase-2-Design.md.

export function representativeVariant<T extends { year: number }>(variants: T[]): T | null {
  if (variants.length === 0) return null;
  return variants.reduce((best, v) => (v.year > best.year ? v : best));
}

export function yearRange(variants: { year: number }[]): string | null {
  if (variants.length === 0) return null;
  const years = variants.map((v) => v.year);
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${min}` : `${min}–${max}`;
}

export function recallCountLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 recall" : `${count} recalls`;
}
