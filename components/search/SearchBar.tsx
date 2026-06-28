export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/cars" method="get" className="flex gap-2.5" role="search">
      <label htmlFor="q" className="sr-only">Search by make or model</label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="e.g. Honda CR-V"
        className="h-12 flex-1 rounded-lg border border-gray-200 px-4 text-base text-gray-900"
      />
      <button
        type="submit"
        className="h-12 rounded-lg bg-blue-600 px-6 text-base font-semibold text-white hover:bg-blue-700"
      >
        Search
      </button>
    </form>
  );
}
