/** @jest-environment node */
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

import { ModelCard } from "@/components/cars/ModelCard";

const base = {
  makeName: "Honda",
  makeSlug: "honda",
  modelName: "CR-V",
  modelSlug: "honda-cr-v",
  bodyType: "SUV",
  recallCount: 1,
  variants: [
    {
      year: 2023,
      fuelType: "Petrol",
      mpgCombined: "38.0",
      co2Gkm: 152,
      dataSource: "CarVector",
      dataFetchedAt: new Date("2026-06-28T00:00:00Z"),
    },
  ],
};

it("renders make, model, body type and links to the detail page", () => {
  const html = renderToStaticMarkup(<ModelCard model={base} />);
  expect(html).toContain("Honda CR-V");
  expect(html).toContain("SUV");
  expect(html).toContain('href="/cars/honda/honda-cr-v"');
});

it("shows a recall flag when recalls exist", () => {
  expect(renderToStaticMarkup(<ModelCard model={base} />)).toContain("1 recall");
});

it("omits the recall flag when there are none", () => {
  const html = renderToStaticMarkup(<ModelCard model={{ ...base, recallCount: 0 }} />);
  expect(html).not.toContain("recall");
});

it("shows 'No data available' for missing specs", () => {
  const html = renderToStaticMarkup(
    <ModelCard
      model={{ ...base, variants: [{ ...base.variants[0], mpgCombined: null, co2Gkm: null }] }}
    />,
  );
  expect(html).toContain("No data available");
});

it("handles a model with no variants", () => {
  const html = renderToStaticMarkup(<ModelCard model={{ ...base, variants: [] }} />);
  expect(html).toContain("No variant data");
});
