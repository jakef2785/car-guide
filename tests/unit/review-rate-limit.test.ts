import {
  withinRateLimit,
  REVIEWS_PER_WINDOW,
  RATE_WINDOW_MS,
} from "@/lib/reviews/rate-limit";

const NOW = new Date("2026-07-07T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe("withinRateLimit", () => {
  it("allows a first review", () => {
    expect(withinRateLimit([], NOW)).toBe(true);
  });

  it("allows up to the limit within the window", () => {
    expect(withinRateLimit([minutesAgo(5), minutesAgo(30)], NOW)).toBe(true);
  });

  it("blocks once the limit is reached inside the window", () => {
    expect(withinRateLimit([minutesAgo(5), minutesAgo(20), minutesAgo(50)], NOW)).toBe(false);
  });

  it("ignores submissions older than the window", () => {
    expect(
      withinRateLimit([minutesAgo(90), minutesAgo(120), minutesAgo(300)], NOW),
    ).toBe(true);
    // Two stale + two fresh = two fresh, still under the limit of three.
    expect(
      withinRateLimit([minutesAgo(90), minutesAgo(120), minutesAgo(5), minutesAgo(10)], NOW),
    ).toBe(true);
  });

  it("treats a submission exactly at the window edge as outside it", () => {
    const atEdge = new Date(NOW.getTime() - RATE_WINDOW_MS);
    expect(withinRateLimit([atEdge, minutesAgo(5), minutesAgo(10)], NOW)).toBe(true);
  });

  it("exports the documented limit of 3 per hour", () => {
    expect(REVIEWS_PER_WINDOW).toBe(3);
    expect(RATE_WINDOW_MS).toBe(60 * 60 * 1000);
  });
});
