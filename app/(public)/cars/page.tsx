import type { Metadata } from "next";
import { parseCarSearchParams } from "@/lib/cars/search-params";
import { listModels } from "@/lib/cars/queries";
import { ModelCard } from "@/components/cars/ModelCard";
import { SearchBar } from "@/components/search/SearchBar";
import { FilterControls } from "@/components/search/FilterControls";

export const metadata: Metadata = {
  title: "Browse cars",
  description: "Browse and filter cars by fuel type, body type and year — every figure source-labelled.",
};

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = parseCarSearchParams(searchParams);
  const models = await listModels(params);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Browse cars</h1>
      <div className="mb-6">
        <SearchBar defaultValue={params.q ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[230px_1fr]">
        <aside className="self-start rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-gray-900">Filters</h2>
          <FilterControls params={params} />
          <div className="mt-3 text-center">
            <a href="/cars" className="text-sm text-blue-600 hover:text-blue-700">Clear all</a>
          </div>
        </aside>

        <section>
          <p className="mb-4 text-sm text-gray-500">
            {models.length} {models.length === 1 ? "car" : "cars"}
          </p>
          {models.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <p className="text-gray-900">No cars match these filters.</p>
              <a
                href="/cars"
                className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
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
