# CarGuide App

Next.js 14 (App Router) + TypeScript + Tailwind, scaffolded from the CarGuide spec.

**Planning, phases, and the full spec live in the Obsidian vault one level up** (`../00-Dashboard.md`) — this repo is code only. Before working on a feature, check the relevant phase note and the spec reference notes there.

## Status
**Phase 1 (Foundation): done** — dev Supabase wired up, Prisma schema + initial migration applied, RLS on every table, CarVector/NHTSA pipeline clients, US seed (~10 makes / 28 models / 30 variants / 65 recalls / 106 complaints), EPA fuel-economy matching, VED utility, and a real model detail page (`/cars/[make]/[model]`) rendering live data with source labels.

**Phase 2 (Browse & Search): built, not yet merged** — restyled homepage, `/cars` browse+search+filter (URL-driven, server-side), `/cars/[make]` index, shared charcoal header/footer, Inter, SEO metadata, unit tests (37 passing). All committed on `feature/phase2-browse-search`; PR #3 into `develop` was opened but not yet merged. `build`/`test`/`lint`/local git all work after a correct-platform `npm install` (see vault decision 0010).

**Phase 2.5 (UK Data Migration): started, uncommitted, undocumented** — `lib/data-pipeline/vca.ts` is a fully-implemented VCA WLTP CSV parser (NOT a stub) and a real VCA CSV sits at `data/vca/euro6_latest.csv`. This work is NOT committed and NOT yet wired into the seed. The seed (`scripts/seed.ts`) is still the US/CarVector Phase 1 seed; the schema has not had the Phase 2.5 changes (`MotReliability`, recall-source rename) applied yet. See the vault's `../02-Phases/Phase-2.5-UK-Data-Migration.md` and `../02-Phases/Next-Steps-Implementation-Strategy.md`.

Next step: `../02-Phases/Next-Steps-Implementation-Strategy.md` in the vault.

## Setup
```bash
npm install
cp .env.local.example .env.local   # fill in from your dev Supabase project
npm run dev
```

## Structure
Matches `../01-Specification/Architecture.md`:
- `app/(public)`, `app/(auth)`, `app/(account)`, `app/api/data-pipeline`
- `components/{ui,cars,search,reviews}`
- `lib/{supabase,data-pipeline,scoring,utils}`
- `prisma/`, `types/`, `tests/{unit,integration,e2e}`
