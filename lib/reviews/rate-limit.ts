// Review-submission rate limit (Security-Requirements.md: "Rate limiting on review submission
// endpoints"). DB-backed: the server action fetches the user's recent submission timestamps and
// asks this pure function — keeping the rule unit-testable and infrastructure-free.
export const REVIEWS_PER_WINDOW = 3;
export const RATE_WINDOW_MS = 60 * 60 * 1000;

export function withinRateLimit(recentSubmissions: Date[], now: Date): boolean {
  const cutoff = now.getTime() - RATE_WINDOW_MS;
  const inWindow = recentSubmissions.filter((d) => d.getTime() > cutoff).length;
  return inWindow < REVIEWS_PER_WINDOW;
}
