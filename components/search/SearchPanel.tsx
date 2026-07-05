// Prominent landing-page search panel (AutoTrader-style): keyword + the headline filters, submitting
// to /cars where the full filter rail takes over. Server-rendered GET form — no client JS. Options
// come from real data facets.
import type { FilterFacets } from "@/lib/cars/queries";

function Select({ name, label, options, anyLabel }: { name: string; label: string; options: string[]; anyLabel: string }) {
  return (
    <label className="flex-1">
      <span className="mb-1.5 block text-sm font-semibold text-gray-900">{label}</span>
      <select name={name} defaultValue="" className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900">
        <option value="">{anyLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchPanel({ facets }: { facets: FilterFacets }) {
  return (
    <form action="/cars" method="get" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <label className="block">
        <span className="sr-only">Search by make or model</span>
        <input
          name="q"
          type="search"
          placeholder="Search make or model, e.g. Golf"
          className="h-12 w-full rounded-lg border border-gray-200 px-4 text-base text-gray-900"
        />
      </label>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Select name="make" label="Make" options={facets.makes} anyLabel="Any make" />
        <Select name="fuel" label="Fuel" options={facets.fuels} anyLabel="Any fuel" />
        <Select name="transmission" label="Gearbox" options={facets.transmissions} anyLabel="Any" />
      </div>

      <button type="submit" className="mt-4 h-12 w-full rounded-lg bg-blue-600 text-base font-semibold text-white hover:bg-blue-700">
        Search cars
      </button>
      <p className="mt-2 text-center text-sm text-gray-500">
        More filters — economy, emissions, power, reliability — on the results page.
      </p>
    </form>
  );
}
