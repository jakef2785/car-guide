import { listMakes } from "@/lib/cars/queries";
import { SearchBar } from "@/components/search/SearchBar";
import { FilterControls } from "@/components/search/FilterControls";
import { MakeTile } from "@/components/cars/MakeTile";

export default async function Home() {
  const makes = await listMakes();

  return (
    <main>
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-12 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Find the right car, backed by real data</h1>
          <p className="mt-3 text-lg text-gray-500">
            Every spec, fuel figure and recall traces to a named source. Nothing is guessed or made up.
          </p>
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <SearchBar />
            <div className="mt-4 border-t border-gray-200 pt-4">
              <FilterControls params={{}} layout="grid" />
            </div>
          </div>
        </div>
        <div className="flex h-72 items-center justify-center rounded-xl border border-gray-200 bg-slate-100 text-slate-400 md:h-80">
          No image
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">Browse by make</h2>
        {makes.length === 0 ? (
          <p className="text-gray-500">No makes available yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
            {makes.map((m) => (
              <MakeTile key={m.slug} name={m.name} slug={m.slug} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-slate-100">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-3">
          <div>
            <h3 className="font-semibold text-gray-900">Every figure is sourced</h3>
            <p className="mt-1 text-sm text-gray-500">Specs, economy and tax trace to VCA (official UK WLTP) and GOV.UK.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Official safety data</h3>
            <p className="mt-1 text-sm text-gray-500">Recalls from DVSA; reliability from real UK MOT outcomes.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">No fabricated data</h3>
            <p className="mt-1 text-sm text-gray-500">Missing data shows &quot;No data available&quot;, never a guess.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
