# Repository guide

## Commands

- Install: `npm install`
- Development: `npm run dev`
- Format: `npm run format` / `npm run format:check`
- Lint: `npm run lint`
- Types: `npm run typecheck`
- Unit/component tests: `npm test`
- Production build: `npm run build`
- End-to-end: `npm run test:e2e`

On Windows PowerShell, use `npm.cmd` if script execution blocks `npm.ps1`.

## Conventions

- Keep Portuguese UI copy correctly accented.
- Keep domain mutations in `lib/domain/operations.ts`, not in components.
- Validate external input at client and server boundaries with Zod.
- Preserve normalized entities and fractional ordering.
- Every material card mutation must create an activity.
- Enforce authorization both in domain code and Supabase RLS.
- Do not expose service-role credentials or attachment contents in logs.
- Prefer soft archival for operational data; permanent deletion requires confirmation and admin access.
- Add or update tests for every domain behavior change.
- Do not implement Trello, Imoview, SLA, automation or analytics features in phase 1.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
