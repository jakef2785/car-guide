import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { cleanModel, niceMake, parseVcaCsv } from "@/lib/data-pipeline/vca";

// --- cleanModel: strip model-year noise, keep real names intact -------------------------------

describe("cleanModel", () => {
  // Existing behaviour (regression guard)
  it.each([
    ["500e MY25", "500e"],
    ["Junior MY25 & MY26", "Junior"],
    ["C40,", "C40"],
    ["C-HR Hybrid -", "C-HR Hybrid"],
    ["NX 450h+", "NX 450h+"],
  ])("keeps handling %s -> %s", (raw, want) => {
    expect(cleanModel(raw)).toBe(want);
  });

  // New: "Model Year <year>" and "Model Year Post <year>" suffixes (Mercedes, Ford)
  it.each([
    ["A-Class Hatchback Model Year 2026", "A-Class Hatchback"],
    ["GLC SUV Model Year 2026", "GLC SUV"],
    ["New Focus Model Year Post 2024.00", "Focus"],
  ])("strips model-year suffix: %s -> %s", (raw, want) => {
    expect(cleanModel(raw)).toBe(want);
  });

  // New: year before MY (Aston Martin), trailing bare year (Honda, Toyota)
  it.each([
    ["Vantage 2021MY", "Vantage"],
    ["Civic Type-R 2023", "Civic Type-R"],
    ["CR-V Hybrid 2024", "CR-V Hybrid"],
    ["HR-V 2025", "HR-V"],
    ["RAV4 PHEV 2026", "RAV4 PHEV"],
  ])("strips trailing year: %s -> %s", (raw, want) => {
    expect(cleanModel(raw)).toBe(want);
  });

  // New: marketing "New " prefix (Renault, VW)
  it.each([
    ["New Austral", "Austral"],
    ["New ZOE", "ZOE"],
    ["New ID.7", "ID.7"],
  ])("strips New prefix: %s -> %s", (raw, want) => {
    expect(cleanModel(raw)).toBe(want);
  });

  // Peugeot's number-names ARE the model — a whole-name year must never be stripped.
  it.each([["2008"], ["3008"], ["5008"]])("preserves whole-name %s", (raw) => {
    expect(cleanModel(raw)).toBe(raw);
  });
});

// --- parseVcaCsv: one variant per user-facing identity ---------------------------------------

const HEADER =
  "Manufacturer,Model,Description,Transmission,Manual or Automatic,Engine Capacity,Fuel Type,Engine Power (PS),WLTP Imperial Low,WLTP Imperial Extra High,WLTP Imperial Combined,WLTP Imperial Combined (Weighted),WLTP CO2,Electric energy consumption Miles/kWh,Maximum range (Miles)";

function csvFile(rows: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), "vca-test-"));
  const file = path.join(dir, "vca.csv");
  writeFileSync(file, [HEADER, ...rows].join("\n"), "latin1");
  return file;
}

describe("parseVcaCsv identity collapse", () => {
  it("collapses same trim listed twice with different WLTP configs, keeping the best-mpg row intact", () => {
    // Real case: Alfa Stelvio 2.0 petrol appears twice (wheel/equipment configs).
    const file = csvFile([
      "ALFA ROMEO,Stelvio MY25,2.0 TURBO PETROL 280HP Q4,A8,Automatic,1995,Petrol,280,25.0,35.1,30.7,,209",
      "ALFA ROMEO,Stelvio MY25,2.0 TURBO PETROL 280HP Q4,A8,Automatic,1995,Petrol,280,28.0,38.2,34,,189",
    ]);
    const out = parseVcaCsv(file);
    expect(out).toHaveLength(1);
    // mpg and co2 must come from the SAME source row — never mixed across configs.
    expect(out[0]).toMatchObject({ model: "Stelvio", mpgCombined: 34, co2Gkm: 189, mpgUrban: 28.0 });
  });

  it("prefers the row with more economy data over a sparser row with better headline mpg", () => {
    const file = csvFile([
      "FORD,Puma,1.0 EcoBoost,M6,Manual,999,Petrol,125,40.1,55.2,47.9,,133",
      "FORD,Puma,1.0 EcoBoost,M6,Manual,999,Petrol,125,,,49.6,,131",
    ]);
    const out = parseVcaCsv(file);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ mpgCombined: 47.9, mpgUrban: 40.1, co2Gkm: 133 });
  });

  it("keeps manual and automatic as separate variants even when the trim name matches", () => {
    const file = csvFile([
      "FORD,Puma,1.0 EcoBoost,M6,Manual,999,Petrol,125,40.1,55.2,47.9,,133",
      "FORD,Puma,1.0 EcoBoost,A7,Automatic,999,Petrol,125,38.0,52.0,45.6,,141",
    ]);
    const out = parseVcaCsv(file);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((v) => v.transmission))).toEqual(new Set(["Manual", "Automatic"]));
  });

  it("collapses model spellings that differ only in case (they share a URL slug)", () => {
    // Real case: Renault lists "Zoe" and "New ZOE"; both clean to the same model page.
    const file = csvFile([
      "RENAULT,Zoe,i Venture Edition R110 Rapid Charge,A1,Electric - Not Applicable,0,Electricity,110,,,,,0",
      "RENAULT,New ZOE,i Venture Edition R110 Rapid Charge,A1,Electric - Not Applicable,0,Electricity,110,,,,,0",
    ]);
    const out = parseVcaCsv(file);
    expect(out).toHaveLength(1);
  });

  it("collapses the same trim across merged model-year rows", () => {
    // "HR-V 2023" and "HR-V 2025" both clean to "HR-V"; identical trims must not double up.
    const file = csvFile([
      "HONDA,HR-V 2023,1.5 i-MMD Advance,CVT,Automatic,1498,Hybrid,131,50.0,49.0,52.3,,122",
      "HONDA,HR-V 2025,1.5 i-MMD Advance,CVT,Automatic,1498,Hybrid,131,50.0,49.0,52.3,,122",
    ]);
    const out = parseVcaCsv(file);
    expect(out).toHaveLength(1);
    expect(out[0].model).toBe("HR-V");
  });
});

describe("parseVcaCsv EV efficiency + range", () => {
  it("keeps the best-efficiency row for same-identity EV rows regardless of CSV order", () => {
    // Real case: Abarth 500e '114kW Electric' appears at 3.6 mi/kWh (164 mi) and 3.3 (152 mi).
    // All MPG/CO2 fields tie for EVs, so without an EV-aware tie-break the winner was whichever
    // row came first in the download — nondeterministic across re-downloads.
    const rows = [
      "ABARTH,500e,114kW Electric,A1,Automatic,0,Electricity,114,,,,,0,3.3,152",
      "ABARTH,500e,114kW Electric,A1,Automatic,0,Electricity,114,,,,,0,3.6,164",
    ];
    for (const ordering of [rows, [...rows].reverse()]) {
      const out = parseVcaCsv(csvFile(ordering));
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ milesPerKwh: 3.6, maxRangeMiles: 164 });
    }
  });

  it("prefers an EV row that has efficiency data over a same-identity row without it", () => {
    const rows = [
      "TESLA,Model 3,RWD,A1,Automatic,0,Electricity,283,,,,,0,0,0",
      "TESLA,Model 3,RWD,A1,Automatic,0,Electricity,283,,,,,0,4.4,391",
    ];
    for (const ordering of [rows, [...rows].reverse()]) {
      const out = parseVcaCsv(csvFile(ordering));
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ milesPerKwh: 4.4, maxRangeMiles: 391 });
    }
  });

  it("parses Miles/kWh and max range for an EV row", () => {
    const file = csvFile([
      "TESLA,Model 3,Long Range AWD,A1,Automatic,0,Electricity,,,,,,0,4.1,340",
    ]);
    const out = parseVcaCsv(file);
    expect(out[0]).toMatchObject({ milesPerKwh: 4.1, maxRangeMiles: 340 });
  });
  it("leaves both null for a combustion row (no fabricated efficiency)", () => {
    const file = csvFile(["FORD,Puma,1.0 EcoBoost,M6,Manual,999,Petrol,125,40.1,55.2,47.9,,133"]);
    const out = parseVcaCsv(file);
    expect(out[0]).toMatchObject({ milesPerKwh: null, maxRangeMiles: null });
  });
  it("treats a 0 value as not-reported, not a real zero", () => {
    const file = csvFile([
      "TESLA,Model 3,Long Range AWD,A1,Automatic,0,Electricity,,,,,,0,0,0",
    ]);
    const out = parseVcaCsv(file);
    expect(out[0]).toMatchObject({ milesPerKwh: null, maxRangeMiles: null });
  });
});

describe("niceMake", () => {
  it("still title-cases and applies overrides", () => {
    expect(niceMake("ALFA ROMEO")).toBe("Alfa Romeo");
    expect(niceMake("BMW")).toBe("BMW");
  });
});
