import Link from "next/link";
import { AuthMenu } from "@/components/auth/AuthMenu";

export function SiteHeader() {
  return (
    <header className="bg-charcoal">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold text-white">
          CarGuide
        </Link>
        <nav className="flex items-center gap-7 text-sm font-medium text-slate-300">
          {/* One entry for /cars — "Browse" and "Search" both pointed there, which read as two
              different destinations. The page itself covers both jobs (browse + filter). */}
          <Link href="/cars" className="hover:text-white">Browse</Link>
          <Link href="/score" className="hover:text-white">Score</Link>
          <AuthMenu />
        </nav>
      </div>
    </header>
  );
}
