import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="bg-charcoal">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold text-white">
          CarGuide
        </Link>
        <nav className="flex gap-7 text-sm font-medium text-slate-300">
          <Link href="/cars" className="hover:text-white">Browse</Link>
          <Link href="/cars" className="hover:text-white">Search</Link>
        </nav>
      </div>
    </header>
  );
}
