import type { Metadata } from "next";
import Link from "next/link";
import { parseCarSearchParams } from "@/lib/cars/search-params";
import { listModels, listFilterFacets, CARS_PAGE_SIZE } from "@/lib/cars/queries";
import { ModelCard } from "@/components/cars/ModelCard";
import { FilterSidebar } from "@/components/search/FilterSidebar";

export const metadata: Metadata = {
  title: "Search cars",
  description: "Filter UK cars by make, fuel, gearbox, engine, power, economy, emissions and MOT reliability — every figure source-labelled.",
};

// Pager link that keeps every active filter and only swaps the page number. Built from the raw
// query (not the parsed params) so unknown/lenient values survive the round trip untouched.
function pageHref(raw: Record<string, string | string[] | undefined>, page: number): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (k === "page" || v === undefined) continue;
    for (const value of Array.isArray(v) ? v : [v]) qs.append(k, value);
  }
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `/cars?${s}` : "/cars";
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = parseCarSearchParams(searchParams);
  const [{ cards, total, page, pageCount }, facets] = await Promise.all([
    listModels(params),
    listFilterFacets(),
  ]);
  const rangeStart = total === 0 ? 0 : (page - 1) * CARS_PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * CARS_PAGE_SIZE + cards.length;

  const filterForm = <FilterSidebar params={params} facets={facets} />;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Search cars</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
        <aside className="self-start md:sticky md:top-4">
          {/* Mobile: the ~12 filter fields stack ABOVE the results at grid-cols-1, so they start
              collapsed (<details> — no JS needed). Desktop keeps the always-open rail. */}
          <details className="rounded-xl border border-gray-200 bg-white p-5 md:hidden">
            <summary className="cursor-pointer text-base font-bold text-gray-900">
              Filters
            </summary>
            <div className="mt-4">{filterForm}</div>
          </details>
          <div className="hidden rounded-xl border border-gray-200 bg-white p-5 md:block">
            <h2 className="mb-4 text-base font-bold text-gray-900">Filters</h2>
            {filterForm}
          </div>
        </aside>

        <section>
          <p className="mb-4 text-sm text-gray-500">
            {total === 0
              ? "0 models"
              : total <= CARS_PAGE_SIZE
                ? `${total} ${total === 1 ? "model" : "models"}`
                : `Showing ${rangeStart}–${rangeEnd} of ${total} models`}
          </p>
          {total === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <p className="text-gray-900">No cars match these filters.</p>
              <a href="/cars" className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
                Clear filters
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {cards.map((m) => (
                  <ModelCard key={`${m.makeSlug}-${m.modelSlug}`} model={m} />
                ))}
              </div>
              {pageCount > 1 && (
                <nav aria-label="Results pages" className="mt-6 flex items-center justify-between">
                  {page > 1 ? (
                    <Link
                      href={pageHref(searchParams, page - 1)}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      ← Previous
                    </Link>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  <span className="text-sm text-gray-600">
                    Page {page} of {pageCount}
                  </span>
                  {page < pageCount ? (
                    <Link
                      href={pageHref(searchParams, page + 1)}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Next →
                    </Link>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
