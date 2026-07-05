import Link from "next/link";

export function MakeTile({ name, slug }: { name: string; slug: string }) {
  return (
    <Link
      href={`/cars/${slug}`}
      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 text-base font-semibold text-gray-900 hover:border-slate-300"
    >
      {name}
      <span aria-hidden="true" className="text-gray-500">›</span>
    </Link>
  );
}
