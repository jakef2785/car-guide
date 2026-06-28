# CarGuide App

Next.js 14 (App Router) + TypeScript + Tailwind, scaffolded from the CarGuide spec.

**Planning, phases, and the full spec live in the Obsidian vault one level up** (`../00-Dashboard.md`) — this repo is code only. Before working on a feature, check the relevant phase note and the spec reference notes there.

## Status
Scaffold only. No Supabase connection, no data pipeline, no pages beyond the Next.js default yet. Next step: `../05-Setup-Checklist.md` in the vault, then Phase 1 tasks in `../02-Phases/Phase-1-Foundation.md`.

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
