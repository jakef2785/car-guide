import {
  motsearchSlug,
  normName,
  parseBrandModels,
  parseModelYearStats,
  parseYearPage,
} from "@/lib/data-pipeline/motsearch";

describe("slug + name normalisation", () => {
  it("builds motsearch slugs (spaces -> underscores, lower-case)", () => {
    expect(motsearchSlug("Alfa Romeo")).toBe("alfa_romeo");
    expect(motsearchSlug("124 Spider")).toBe("124_spider");
  });
  it("normName ignores case, punctuation and model-year tokens", () => {
    expect(normName("C-HR")).toBe("c hr");
    expect(normName("Junior MY25")).toBe("junior");
  });
});

describe("parseBrandModels", () => {
  it("extracts model slug + display name from brand-page links", () => {
    const html = `
      <a href="https://www.motsearch.co.uk/stats/ford/focus/">Focus</a>
      <a href="https://www.motsearch.co.uk/stats/ford/fiesta/"><span>Fiesta</span></a>
      <a href="https://www.motsearch.co.uk/stats/other/x/">X</a>`;
    const models = parseBrandModels(html, "Ford");
    expect(models).toEqual([
      { slug: "focus", name: "Focus" },
      { slug: "fiesta", name: "Fiesta" },
    ]);
  });
});

describe("parseModelYearStats", () => {
  it("parses the embedded rawData into per-year faults vs average", () => {
    const html = `<script>const rawData = [{"model_year":"2014","model_avg":"232.00","year_avg":"198.00"},{"model_year":"2015","model_avg":"215.00","year_avg":"174.00"}];</script>`;
    expect(parseModelYearStats(html)).toEqual([
      { modelYear: "2014", defectsPer100: 232, yearAvgPer100: 198 },
      { modelYear: "2015", defectsPer100: 215, yearAvgPer100: 174 },
    ]);
  });
  it("returns [] when no rawData block is present", () => {
    expect(parseModelYearStats("<html>nope</html>")).toEqual([]);
  });
});

describe("parseYearPage", () => {
  // Mirrors the real motsearch markup (sample-size line, headline, one category card with defects).
  const html = `
    Sample size: 820 cars, 2,034 tests and 4,383 recorded faults.
    <div style="...">215.5 faults per 100 tests</div>
    <div class="subtle">Year average for all cars of 2015 is 174.5 faults per 100 tests</div>
    <h2>Categories</h2>
    <div class="card cat-card h-100"><div class="card-body">
      <div class="fw-semibold">Brakes</div>
      <span class="fw-bold" style="color:#f97316;">▼ 18.1% worse</span>
      <div style="...">100.0 <span style="..."> faults / 100 tests</span></div>
      <div class="small subtle mb-2">Year avg: 84.7 / 100 tests</div>
      <ul class="bullets ps-3 mb-0"><li>Brake disc or drum: insecure</li><li>Brake lining or pad: worn below 1.5mm</li></ul>
    </div></div>
    <div class="card cat-card h-100"><div class="card-body">
      <div class="fw-semibold">Steering</div>
      <span class="fw-bold" style="color:#22c55e;">▲ 78.8% better</span>
      <div style="...">2.1 <span style="..."> faults / 100 tests</span></div>
      <div class="small subtle mb-2">Year avg: 9.9 / 100 tests</div>
    </div></div>`;

  it("extracts sample size, headline rates and category faults", () => {
    const s = parseYearPage(html);
    expect(s.sampleCars).toBe(820);
    expect(s.testCount).toBe(2034);
    expect(s.recordedFaults).toBe(4383);
    expect(s.modelPer100).toBe(215.5);
    expect(s.yearAvgPer100).toBe(174.5);
    expect(s.categories).toHaveLength(2);

    const brakes = s.categories[0];
    expect(brakes.category).toBe("Brakes");
    expect(brakes.modelPer100).toBe(100);
    expect(brakes.yearAvgPer100).toBe(84.7);
    expect(brakes.deltaPct).toBe(18.1); // worse -> positive
    expect(brakes.defects).toEqual([
      "Brake disc or drum: insecure",
      "Brake lining or pad: worn below 1.5mm",
    ]);

    expect(s.categories[1].deltaPct).toBe(-78.8); // better -> negative
    expect(s.categories[1].defects).toEqual([]);
  });
});
