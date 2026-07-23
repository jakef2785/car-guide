// Renders one model-year variant's specs. Every field either shows real data + its source,
// or "No data available" — never a guess. See Guiding-Principles.md "no fabricated data".
import { SourceTag } from "@/components/ui/SourceTag";
import { caveatFor } from "@/lib/utils/source-caveats";

type Variant = {
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
  milesPerKwh: string | number | null;
  maxRangeMiles: number | null;
  vedFirstYearGbp: number | null;
  vedAssumptionApplied: boolean;
  dataSource: string;
  dataFetchedAt: Date;
};

function Spec({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">
        {value === null || value === undefined ? "No data available" : `${value}${unit ?? ""}`}
      </span>
    </div>
  );
}

export function VariantSpecsCard({ variant }: { variant: Variant }) {
  const fetchedAt = new Date(variant.dataFetchedAt);
  const hasFuelEconomyData = variant.mpgCombined !== null || variant.co2Gkm !== null;

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          {variant.trimName ?? "Standard"}
        </h3>
        <SourceTag source={variant.dataSource} fetchedAt={fetchedAt} />
      </div>

      <div>
        <Spec label="Engine size" value={variant.engineSizeCc} unit=" cc" />
        <Spec label="Fuel type" value={variant.fuelType} />
        <Spec label="Transmission" value={variant.transmission} />
        <Spec label="Horsepower" value={variant.horsepower} unit=" hp" />
        <Spec label="Torque" value={variant.torqueNm} unit=" Nm" />
        <Spec label="0–60 mph" value={variant.zeroToSixty} unit=" s" />
        <Spec label="Top speed" value={variant.topSpeedMph} unit=" mph" />
        <Spec label="Doors" value={variant.doors} />
        <Spec label="Seats" value={variant.seats} />
        <Spec label="Kerb weight" value={variant.kerbWeightKg} unit=" kg" />
      </div>

      <div className="mb-1 mt-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Fuel economy &amp; tax</h4>
        {/* For UK (Phase 2.5) data, specs and fuel economy/CO2 both come from VCA in one row, so
            the section reuses variant.dataSource. (Phase 1 US data sourced economy separately from
            EPA; the schema still tracks one data_source per variant — see vault decision 0004.) */}
        {hasFuelEconomyData && <SourceTag source={variant.dataSource} fetchedAt={fetchedAt} />}
      </div>
      <div>
        <Spec label="MPG (urban)" value={variant.mpgUrban} unit=" mpg" />
        <Spec label="MPG (extra-urban)" value={variant.mpgExtraUrban} unit=" mpg" />
        <Spec label="MPG (combined)" value={variant.mpgCombined} unit=" mpg" />
        {/* Electric rows only when the variant actually has them (EV/PHEV) — an ICE card
            shouldn't grow two more "No data available" lines. */}
        {(variant.milesPerKwh !== null || variant.maxRangeMiles !== null) && (
          <>
            <Spec label="Efficiency" value={variant.milesPerKwh} unit=" mi/kWh" />
            <Spec label="Electric range" value={variant.maxRangeMiles} unit=" miles" />
          </>
        )}
        <Spec label="CO₂ emissions" value={variant.co2Gkm} unit=" g/km" />
        <Spec
          label="First-year VED"
          value={variant.vedFirstYearGbp !== null ? `£${variant.vedFirstYearGbp}` : null}
        />
        {variant.vedFirstYearGbp !== null && (
          <p className="pt-1 text-xs text-slate-600">
            {/* ved.ts defaults diesels to the higher non-RDE2 band when NOx compliance is unknown;
                that decision is persisted per-variant (vedAssumptionApplied) — caveat from the
                data itself, not a guess off the fuel-type string. */}
            {variant.vedAssumptionApplied
              ? "Assumes non-RDE2 diesel — the actual first-year rate may be lower; confirm at GOV.UK."
              : caveatFor("VED-computed")}
          </p>
        )}
      </div>
    </div>
  );
}
