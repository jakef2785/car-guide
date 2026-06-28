export function SiteFooter() {
  return (
    <footer className="mt-12 bg-charcoal">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6">
        <span className="text-base font-medium text-white">CarGuide</span>
        <span className="text-xs text-slate-400">
          Data sources: CarVector · NHTSA · EPA · GOV.UK VED — US-centric catalogue
        </span>
      </div>
    </footer>
  );
}
