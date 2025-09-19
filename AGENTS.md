# Repository Guidelines

## Project Structure & Module Organization
This Electron + Vite repo is TypeScript-centric: `src/` holds renderer routes, pages, and atoms; `workers/` powers background jobs; `shared/` captures cross-process utilities; `packages/` contains feature adapters and UI primitives. Static files stay in `assets/`, database artifacts in `drizzle/`, and reference docs in `docs/`. Testing helpers live in `testing/`, while Playwright specs reside in `e2e-tests/`. Root configs (`vite.*`, `vitest.config.ts`, `forge.config.ts`, `biome.json`) keep builds and linting consistent.

## Build, Test, and Development Commands
- `npm run start` launches Electron Forge with the default engine.
- `npm run dev:engine` / `npm run staging:*` swap gateway URLs for QA.
- `npm run ts` type-checks renderer and worker targets.
- `npm run lint` (Oxlint) and `npm run prettier:check` gate formatting.
- `npm run package` or `npm run make` create distributables after `npm run clean`.
- `npm run test` executes Vitest; `npm run e2e` runs Playwright post `npm run pre:e2e`.

## Coding Style & Naming Conventions
Indent two spaces, favor named ES module imports, and use `.tsx` for UI surfaces. CamelCase variables/functions, PascalCase components, kebab-case directories. Defer to Prettier for formatting and Oxlint for static analysis—avoid local overrides unless committed configs allow it. Shared logic spanning renderer and worker contexts belongs in `shared/` to prevent duplication.

## Testing Guidelines
Create unit specs under `src/__tests__` with the `*.test.ts` suffix mirroring the target module. Use `npm run test:watch` during development and add coverage whenever touching provider integrations, settings, or chat flows. Playwright scenarios in `e2e-tests/` validate multi-window and API interactions; shard heavy runs with `npm run e2e:shard`. Keep fixtures in `testing/` up to date to avoid flaky assertions.

## Commit & Pull Request Guidelines
Follow the prevailing Git history: concise, imperative subjects, optional `feat:` prefixes, and GitHub issue references in parentheses (`(#1234)`). Group related work into single commits when practical. Run `npm run presubmit` before opening a PR, summarize the change, include validation notes, and attach UI evidence when visuals shift. Flag environment or migration steps (`drizzle db:generate`, `db:push`) so reviewers can reproduce outcomes.

## Security & Configuration Tips
Declare environment contracts in `forge.env.d.ts` and keep overrides in untracked `.env` files. Document new variables in `docs/` and scrub Playwright recordings for secrets. Inspect artifacts before `npm run publish` to ensure provider keys or debug bundles never ship.
