// AutoTrader-style filter rail for the results page. A single server-rendered GET form → /cars, so
// filters are URL-driven and need no client JS. Options come from real data facets, so we never
// offer a value that returns nothing. Only variables we actually hold are filterable (no price /
// mileage / year — see search-params note on the missing model year).
import type { CarSearchParams, SortKey } from "@/lib/cars/search-params";
import type { FilterFacets } from "@/lib/cars/queries";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "make", label: "Make (A–Z)" },
  { value: "mpg", label: "Best MPG" },
  { value: "co2", label: "Lowest CO₂" },
  { value: "power", label: "Most power" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-gray-900">{label}</span>
      {children}
    </div>
  );
}

function Select({
  name,
  options,
  selected,
  anyLabel = "Any",
}: {
  name: string;
  options: (string | number)[];
  selected?: string | number;
  anyLabel?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={selected ?? ""}
      className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
    >
      <option value="">{anyLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function NumRange({
  fromName,
  toName,
  from,
  to,
  min,
  max,
  unit,
}: {
  fromName: string;
  toName: string;
  from?: number;
  to?: number;
  min: number;
  max: number;
  unit?: string;
}) {
  const cls = "h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900";
  return (
    <div className="flex items-center gap-2">
      <input type="number" name={fromName} defaultValue={from ?? ""} placeholder={`Min${unit ? " " + unit : ""} (${min})`} min={0} className={cls} />
      <span className="text-gray-400">–</span>
      <input type="number" name={toName} defaultValue={to ?? ""} placeholder={`Max (${max})`} min={0} className={cls} />
    </div>
  );
}

export function FilterSidebar({ params, facets }: { params: CarSearchParams; facets: FilterFacets }) {
  return (
    <form action="/cars" method="get" className="space-y-4">
      <Field label="Keyword">
        <input
          name="q"
          type="search"
          defaultValue={params.q ?? ""}
          placeholder="Make or model"
          className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
        />
      </Field>

      <Field label="Make">
        <Select name="make" options={facets.makes} selected={params.make} anyLabel="Any make" />
      </Field>
      <Field label="Fuel type">
        <Select name="fuel" options={facets.fuels} selected={params.fuel} />
      </Field>
      <Field label="Gearbox">
        <Select name="transmission" options={facets.transmissions} selected={params.transmission} />
      </Field>
      {facets.bodies.length > 0 && (
        <Field label="Body type">
          <Select name="body" options={facets.bodies} selected={params.body} />
        </Field>
      )}

      <Field label="Engine size (cc)">
        <NumRange fromName="engineFrom" toName="engineTo" from={params.engineFrom} to={params.engineTo} min={facets.engine.min} max={facets.engine.max} />
      </Field>
      <Field label="Power (ps)">
        <NumRange fromName="powerFrom" toName="powerTo" from={params.powerFrom} to={params.powerTo} min={facets.power.min} max={facets.power.max} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Min MPG`}>
          <input type="number" name="mpgMin" defaultValue={params.mpgMin ?? ""} placeholder={`${facets.mpg.max}`} min={0} className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900" />
        </Field>
        <Field label={`Max CO₂`}>
          <input type="number" name="co2Max" defaultValue={params.co2Max ?? ""} placeholder={`${facets.co2.max}`} min={0} className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-900">
        <input type="checkbox" name="reliability" value="better" defaultChecked={params.reliability === "better"} className="h-4 w-4 rounded border-gray-300" />
        Better-than-average MOT reliability
      </label>

      <Field label="Sort by">
        <select
          name="sort"
          defaultValue={params.sort ?? ""}
          className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
        >
          <option value="">Relevance</option>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      <button type="submit" className="h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
        Show cars
      </button>
      <div className="text-center">
        <a href="/cars" className="text-sm text-blue-600 hover:text-blue-700">
          Clear all filters
        </a>
      </div>
    </form>
  );
}
