import type { Metadata } from "next";
import { parseCarSearchParams } from "@/lib/cars/search-params";
import { listModels, listFilterFacets } from "@/lib/cars/queries";
import { ModelCard } from "@/components/cars/ModelCard";
import { FilterSidebar } from "@/components/search/FilterSidebar";

export const metadata: Metadata = {
  title: "Search cars",
  description: "Filter UK cars by make, fuel, gearbox, engine, power, economy, emissions and MOT reliability — every figure source-labelled.",
};

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = parseCarSearchParams(searchParams);
  const [models, facets] = await Promise.all([listModels(params), listFilterFacets()]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Search cars</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
        <aside className="self-start rounded-xl border border-gray-200 bg-white p-5 md:sticky md:top-4">
          <h2 className="mb-4 text-base font-bold text-gray-900">Filters</h2>
          <FilterSidebar params={params} facets={facets} />
        </aside>

        <section>
          <p className="mb-4 text-sm text-gray-500">
            {models.length} {models.length === 1 ? "model" : "models"}
          </p>
          {models.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <p className="text-gray-900">No cars match these filters.</p>
              <a href="/cars" className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
                Clear filters
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {models.map((m) => (
                <ModelCard key={`${m.makeSlug}-${m.modelSlug}`} model={m} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
