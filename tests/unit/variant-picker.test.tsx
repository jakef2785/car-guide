/** @jest-environment node */
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { VariantPicker, type PickerVariant } from "@/components/cars/VariantPicker";

function variant(overrides: Partial<PickerVariant>): PickerVariant {
  return {
    id: `id-${JSON.stringify(overrides)}`,
    trimName: "1.0 EcoBoost",
    engineSizeCc: 999,
    fuelType: "Petrol",
    transmission: "Manual",
    horsepower: 125,
    torqueNm: null,
    zeroToSixty: null,
    topSpeedMph: null,
    doors: null,
    seats: null,
    kerbWeightKg: null,
    mpgUrban: null,
    mpgExtraUrban: null,
    mpgCombined: "47.9",
    co2Gkm: 133,
    vedAnnualGbp: 180,
    dataSource: "VCA",
    dataFetchedAt: new Date("2026-06-29"),
    ...overrides,
  };
}

function optionLabels(markup: string): string[] {
  return Array.from(markup.matchAll(/<option[^>]*>(.*?)<\/option>/g)).map((m) => m[1]);
}

describe("VariantPicker option labels", () => {
  it("includes the gearbox so manual/automatic pairs of the same trim are distinguishable", () => {
    const markup = renderToStaticMarkup(
      <VariantPicker
        variants={[variant({ transmission: "Manual" }), variant({ transmission: "Automatic" })]}
      />
    );
    const labels = optionLabels(markup);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain("Manual");
    expect(labels[1]).toContain("Automatic");
    expect(labels[0]).not.toEqual(labels[1]);
  });
});
