// Listing card for one model. Shows only real fields, every figure source-labelled, missing
// data as "No data available" — never guessed (Guiding-Principles). No model year shown: the VCA
// catalogue has no real per-variant year (see search-params note). Image is a placeholder this
// phase (vault decision 0009). Composes tested helpers from lib/cars/card-data.
import Link from "next/link";
import { SourceTag } from "@/components/ui/SourceTag";
import { representativeVariant, trimCountLabel, recallCountLabel } from "@/lib/cars/card-data";

export type ModelCardVariant = {
  fuelType: string | null;
  transmission: string | null;
  engineSizeCc: number | null;
  horsepower: number | null;
  mpgCombined: string | null;
  co2Gkm: number | null;
  dataSource: string;
  dataFetchedAt: Date;
};

export type ModelCardModel = {
  makeName: string;
  makeSlug: string;
  modelName: string;
  modelSlug: string;
  bodyType: string | null;
  recallCount: number;
  variantCount: number;
  variants: ModelCardVariant[];
};

function spec(value: string | number | null, unit = ""): string {
  return value === null || value === undefined ? "No data available" : `${value}${unit}`;
}

export function ModelCard({ model }: { model: ModelCardModel }) {
  const rep = representativeVariant(model.variants);
  const trims = trimCountLabel(model.variantCount);
  const recallLabel = recallCountLabel(model.recallCount);
  const href = `/cars/${model.makeSlug}/${model.modelSlug}`;

  return (
    <Link
      href={href}
      className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors hover:border-slate-300"
    >
      <div className="flex w-28 flex-shrink-0 items-center justify-center bg-slate-100" aria-hidden="true">
        <span className="text-sm text-slate-400">No image</span>
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold text-gray-900">
            {model.makeName} {model.modelName}
          </h3>
          {model.bodyType && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {model.bodyType}
            </span>
          )}
        </div>

        {rep ? (
          <>
            <p className="mt-1.5 text-sm text-gray-500">
              {spec(rep.fuelType)} · {spec(rep.mpgCombined, " mpg")} · {spec(rep.co2Gkm, " g/km")}
            </p>
            {trims && <p className="mt-1 text-sm text-gray-400">{trims}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {recallLabel && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {recallLabel}
                </span>
              )}
              <SourceTag source={rep.dataSource} fetchedAt={new Date(rep.dataFetchedAt)} />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No variant data available.</p>
        )}
      </div>
    </Link>
  );
}
