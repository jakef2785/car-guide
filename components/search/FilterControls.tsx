import type { CarSearchParams } from "@/lib/cars/search-params";

const FUELS = ["Petrol", "Diesel", "Hybrid", "Electric"];
const BODIES = ["Hatchback", "Saloon", "SUV", "Estate"];
const YEARS = [2015, 2017, 2019, 2021, 2023, 2024];

function Select({
  id,
  label,
  name,
  options,
  selected,
  labelHidden = false,
}: {
  id: string;
  label: string;
  name: string;
  options: (string | number)[];
  selected?: string | number;
  labelHidden?: boolean;
}) {
  return (
    <div className="flex-1">
      <label htmlFor={id} className={labelHidden ? "sr-only" : "mb-1.5 block text-sm font-semibold text-gray-900"}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={selected ?? ""}
        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function FilterControls({
  params,
  layout = "stacked",
}: {
  params: CarSearchParams;
  layout?: "stacked" | "grid";
}) {
  return (
    <form action="/cars" method="get" className={layout === "grid" ? "grid grid-cols-2 gap-3.5" : "space-y-4"}>
      {params.q && <input type="hidden" name="q" value={params.q} />}
      <Select id="fuel" label="Fuel type" name="fuel" options={FUELS} selected={params.fuel} />
      <Select id="body" label="Body type" name="body" options={BODIES} selected={params.body} />
      <div className={layout === "grid" ? "col-span-2" : ""}>
        <span className="mb-1.5 block text-sm font-semibold text-gray-900">Year range</span>
        <div className="flex items-center gap-2.5">
          <Select id="yearFrom" label="From year" name="yearFrom" options={YEARS} selected={params.yearFrom} labelHidden />
          <span className="text-gray-500">to</span>
          <Select id="yearTo" label="To year" name="yearTo" options={YEARS} selected={params.yearTo} labelHidden />
        </div>
      </div>
      <button
        type="submit"
        className={`h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 ${layout === "grid" ? "col-span-2" : ""}`}
      >
        Apply filters
      </button>
    </form>
  );
}
