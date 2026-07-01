"use client";

// Lets the user pick ONE trim/variant to inspect rather than dumping every variant on the page.
// A model can have dozens of VCA variants; a dropdown keeps the detail page focused. Renders the
// selected variant's full spec card.
import { useState } from "react";
import { VariantSpecsCard } from "@/components/cars/VariantSpecsCard";

export type PickerVariant = {
  id: string;
  trimName: string | null;
  engineSizeCc: number | null;
  fuelType: string | null;
  transmission: string | null;
  horsepower: number | null;
  torqueNm: number | null;
  zeroToSixty: string | number | null;
  topSpeedMph: number | null;
  doors: number | null;
  seats: number | null;
  kerbWeightKg: number | null;
  mpgUrban: string | number | null;
  mpgExtraUrban: string | number | null;
  mpgCombined: string | number | null;
  co2Gkm: number | null;
  vedAnnualGbp: number | null;
  dataSource: string;
  dataFetchedAt: Date;
};

// A human label that disambiguates trims that share a name (adds engine/power/fuel).
function label(v: PickerVariant): string {
  const parts = [
    v.trimName ?? "Standard",
    v.engineSizeCc ? `${v.engineSizeCc}cc` : null,
    v.horsepower ? `${v.horsepower}ps` : null,
    v.fuelType,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function VariantPicker({ variants }: { variants: PickerVariant[] }) {
  const [index, setIndex] = useState(0);

  if (variants.length === 0) {
    return <p className="text-sm text-gray-500">No variant data available for this model.</p>;
  }

  const selected = variants[index] ?? variants[0];

  return (
    <div>
      {variants.length > 1 && (
        <label className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
          <span>Trim / variant ({variants.length})</span>
          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-normal text-slate-900"
          >
            {variants.map((v, i) => (
              <option key={v.id} value={i}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
      )}
      <VariantSpecsCard variant={selected} />
    </div>
  );
}
