# Contributing to ClockIn

## Source of truth

| Question | Doc |
|---|---|
| What should it do? | [`implementation/PRD.md`](implementation/PRD.md) |
| How is it built? | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| How should it look? | [`implementation/DESIGN_SYSTEM.md`](implementation/DESIGN_SYSTEM.md) + PNGs in [`ui/`](ui/SCREENS.md) |
| Where does code go? | [`CODE_STRUCTURE.md`](CODE_STRUCTURE.md) |
| What's next? | [`../PLAN.md`](../PLAN.md) |

PNG is the visual truth; the HTML next to it has the exact copy, spacing and sample data. If code needs to differ from a doc, change the doc in the same PR.

## Workflow

1. Pick the next unchecked task in `PLAN.md` (or an issue that references one).
2. Branch from `main`: `feat/<scope>-<short-desc>`, `fix/…`, `chore/…`, `docs/…` (e.g. `feat/api-clock-in`).
3. Small PRs (aim < 400 changed lines excluding generated files). One milestone = several PRs.
4. Open a PR using the checklist below; CI must be green; at least one review (self-review with a checklist is fine while solo).
5. Squash merge. Tick the task in `PLAN.md` in the PR that finishes it.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `build`
- Scopes: `api`, `admin`, `mobile`, `schema`, `infra`, `docs`
- Subject ≤ 50 chars, imperative. Body explains why when not obvious.

Example: `feat(api): reject clock-in outside geofence`

## Code conventions

### All

- Package manager is **Bun**: `bun install`, `bun add`, `bun run <script>`. Do not commit npm/pnpm/yarn lockfiles; only `bun.lock`.
- English everywhere: code, comments, docs, UI copy (through i18n keys, never hard-coded).
- No secrets in the repo. Add new env keys to `.env.example` and the config schema.
- Dates `YYYY-MM-DD`, instants UTC ISO-8601 in APIs; display `8 Oct 2026`, 24-hour time, WIB/WITA/WIT.
- Status names use the enums in DESIGN_SYSTEM §9 across API, web and mobile.

### Backend (`apps/api`)

- TypeScript strict; no `any` without a comment explaining why.
- Thin controllers, logic in services, DTOs with class-validator + Swagger decorators.
- Every tenant query goes through the tenancy-aware Prisma client; every admin list goes through `ScopeService`.
- Every mutation that matters to HR writes an audit entry in the same transaction.
- Errors: throw domain errors with a stable `code`; never leak stack traces or whether an account exists.
- Migrations: one per PR when needed, never edit a merged migration. Name: `yyyymmddhhmm_short_desc`.
- After changing endpoints run `bun run --filter api openapi:emit` and commit `packages/api-schema`.

### Web admin (`apps/admin`)

- Nuxt UI components first; custom components only for the list in DESIGN_SYSTEM §8.
- Use theme tokens (`text-muted`, `bg-elevated`, `brand-600`…), never raw hex in components.
- Data via the generated client (`useApi`); no `fetch` to the API from the browser except through the BFF.
- Filters, sort and pagination live in the URL query.
- Forms: `UForm` + zod schema; show API error `code` messages inline.

### Mobile (`apps/mobile`)

- MVVM: Screen (View) → ViewModel → Repository/use case (Model). One ViewModel + immutable `UiState` per screen; no business logic in composables (CODE_STRUCTURE §4).
- Android first: put everything that doesn't need an Android API in `commonMain`; phone features go behind interfaces in `core/platform` with implementations in `androidMain` (iOS later).
- Use theme values (`MaterialTheme`, `LocalStatusColors`), never inline colors.
- Strings in Compose resources; content descriptions for every icon-only control.
- Never block the UI thread on location, camera or network.

## Testing

| Change | Required tests |
|---|---|
| Business rule (status, schedule, geofence, offline time, balances, approvals) | Unit tests with edge cases |
| New/changed endpoint | e2e test incl. auth, validation, scope isolation |
| Web page with a form or destructive action | Component test or Playwright flow |
| Mobile ViewModel / use case | commonTest |
| Bug fix | A test that fails without the fix |

Run locally before pushing: `bun run lint && bun run typecheck && bun run test` (and `./gradlew check` for mobile).

## PR checklist

```
- [ ] Linked PLAN.md task / issue
- [ ] Tests added/updated and passing
- [ ] OpenAPI + client regenerated (if API changed)
- [ ] Migration included and reversible-safe (if schema changed)
- [ ] Audit entries for new mutations
- [ ] i18n keys, no hard-coded copy
- [ ] Matches the PNG/HTML for affected screens (screenshot attached for UI changes)
- [ ] Docs updated if behavior differs from PRD/ARCHITECTURE
```

## Changing the docs

- PRD: bump the version line and add a row to "Changes in vX" at the top.
- ARCHITECTURE: update the section and keep the PRD summary (§12) consistent.
- New screen or state: add it to `ui/SCREENS.md` (and to "Not designed yet" in the PRD until a design exists).
