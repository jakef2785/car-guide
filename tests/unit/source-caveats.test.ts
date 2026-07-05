import { caveatFor, formatFetchedAt, sourceLabel } from "@/lib/utils/source-caveats";

describe("caveatFor", () => {
  it("returns the documented caveat for a known source", () => {
    expect(caveatFor("EPA")).toBe(
      "US EPA test cycle, converted to UK imperial MPG — not an official UK-certified figure.",
    );
    expect(caveatFor("NHTSA")).toBe("US federal data only.");
  });

  it("documents the UK Phase 2.5 sources", () => {
    expect(caveatFor("VCA")).toMatch(/WLTP/);
    expect(caveatFor("DVSA")).toMatch(/recall/i);
    expect(caveatFor("DVSA MOT")).toMatch(/reliability signal/i);
  });

  it("falls back to a verify-before-relying warning for an undocumented source", () => {
    expect(caveatFor("SomeNewSource")).toMatch(/not documented/);
  });
});

describe("formatFetchedAt", () => {
  it("formats a date as YYYY-MM-DD, dropping the time component", () => {
    expect(formatFetchedAt(new Date("2026-06-28T16:05:32.426Z"))).toBe("2026-06-28");
  });
});

describe("sourceLabel", () => {
  it("combines source name and fetched date", () => {
    expect(sourceLabel("CarVector", new Date("2026-06-28T00:00:00.000Z"))).toBe(
      "CarVector, fetched 2026-06-28",
    );
  });
});
