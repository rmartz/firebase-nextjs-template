# Code Standards

## Package Manager

- Always use `pnpm`. Never `npm` or `yarn`.

## Dependencies

- **Pin full versions in `package.json`.** Every dependency specifier must name the
  full `[major].[minor].[patch]` version, even when it carries a range operator —
  e.g. `"prettier": "^3.8.4"`, never `"prettier": "^3"` or `"^3.8"`. A bare-major or
  major-only-minor range lets Dependabot satisfy a bump via the lockfile alone, with
  **no `package.json` diff**, so the update is invisible in review — exactly how a
  Prettier minor bump can reformat the codebase and surface only as an unexplained CI
  failure. Full pins force Dependabot to rewrite the specifier on every bump, keeping
  dependency updates explicit in the manifest. (`github:`, `workspace:`, `file:`, and
  `link:` specifiers are exempt — they carry no semver range.)

- **Pin GitHub Actions to a commit SHA.** Every third-party action in
  `.github/workflows/*.yml` and `.github/actions/*/action.yml` must pin the full
  40-char commit SHA with the version in a trailing comment — e.g.
  `uses: actions/checkout@9c091bb… # v7.0.0`, never `@v7`. A mutable tag can be
  silently repointed at attacker-controlled code that CI would then run with the
  workflow token; a SHA is immutable. The `# <version>` comment is Dependabot's
  convention — it reads the version there and bumps the SHA and comment together.
  Local composite refs (`./.github/actions/*`) are in-repo and exempt. Enforced by
  `pnpm run actions:validate` (the **Action pins** CI job).

## Common Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # Lint
pnpm format           # Format
pnpm test             # Run headless tests with Vitest (node / hooks / components)
pnpm test:storybook   # Run Storybook stories as browser tests (Chromium; needs `pnpm exec playwright install chromium`)
pnpm tsc              # Type check
pnpm storybook        # Start Storybook dev server (port 6006)
pnpm build-storybook  # Build static Storybook
pnpm screenshots      # Screenshot every story for visual review (run after build-storybook)
pnpm run env:validate # Validate deployment config files against schema (also runs pre-commit)
pnpm run pins:validate # Check package.json pins are full [major].[minor].[patch] versions
pnpm run actions:validate # Check GitHub Actions are pinned to commit SHAs
```

## Worktree Setup

After creating a git worktree (`git worktree add .git-worktrees/`), run `pnpm install --frozen-lockfile` inside it before invoking any build, test, or lint commands. pnpm's `node-modules` linker creates per-directory `node_modules` trees; a fresh worktree has none. The global store is already populated so this step only creates hardlinks — it takes a few seconds and requires no network access.

## Deployment Config

Public (non-secret) environment config lives in `deployment/{env}.yml` and is validated against `deployment/schema.yml`. Only `NEXT_PUBLIC_*` and explicitly allowlisted keys are permitted; patterns matching `*SECRET*`, `*_TOKEN*`, or `*PRIVATE_KEY*` are hard-denied.

- To update a public config value (YAML only): `scripts/update-config.sh --env=<env> KEY=value`
- Pushing config to Vercel, pulling local env vars, and rotating secrets are handled by the `envctl` CLI (in development).
- Deployment config is validated on every commit via `.husky/pre-commit`; also enforced in CI via `.github/workflows/config-validate.yml`

## TypeScript

- Strict mode throughout. No `any` types. No `@ts-ignore`.
- Do not use `null` unless required for API compatibility or when explicitly distinguishing `null` from `undefined`. Prefer `undefined` for absent/optional values throughout the codebase.
- Prefer explicit `interface` names scoped to their component (e.g., `interface UserProfileCardProps` not `interface Props`).
- Use `async/await`, not `.then()` chains.

## File Organization

- **Source files**: Keep under ~200 lines (split at ~240). Large files should be split by logical concern. A **hard cap of 400 lines** is enforced by the eslint `max-lines` rule (`pnpm lint` / editor / the Lint CI job); the ~200/240 targets are what you aim for well under it, not the limit.
- **Test files**: Keep under ~300 lines (split at ~360), **hard cap 600** (also eslint `max-lines`). Use `.spec.ts` / `.spec.tsx` extension (not `.test.ts`). When splitting, organize into a `{module}-tests/` directory with domain-specific files.
- **Components**: A component file contains its primary component and props interface. A sub-component may be co-located in the same file if it owns no hooks, state, effects, or context, and is used only by the parent component in that file — e.g., a context wrapper, structural template, or props alias. A sub-component must be in its own file when any of these are true: it owns hooks, state, effects, or context; it is referenced from multiple parents; or it is substantial enough to warrant its own stories or tests (e.g., list items, row components, panels, form sections). All component props must be defined as an explicitly named interface (e.g., `interface UserListProps`), never inline in the function signature.
- **Type files**: Convert large type files into barrel-exported directories with one file per logical domain.
- Add a barrel `index.ts` when a component or module directory exposes a public API or already
  follows a barrel pattern; do not require one for every directory (e.g. ShadCN-generated
  `src/components/ui/` has no barrel by convention).
- Use named exports, not default exports (except for Next.js pages, Redux slices, and
  Storybook story files, where the only allowed default export is the required
  `export default meta`; stories and components must remain named exports).

## Code Conventions

- **Favor type inference.** Explicit generic type arguments (for example, `someFn<Foo>(...)`) are a code smell when TypeScript can infer them.
- **No spurious variables.** Do not assign a value to a variable only to immediately return it on the next line — return the expression directly instead.
- **No IIFEs.** Do not use immediately-invoked function expressions. Extract the logic into a named helper function or compute the value with a plain expression instead.
- **No function-style imports.** Do not use inline `import("…").Type` syntax in type annotations. Use module-level `import type { … } from "…"` statements at the top of the file. Dynamic `await import("…")` for services that require conditional loading (e.g., Sentry instrumentation) is acceptable.
- **No unnecessary helpers.** Do not extract logic into a helper function unless it separates significant logic or belongs in a different module. Three similar lines is better than a premature abstraction.
- **Enums, constant objects, and `as const` value arrays** should be kept in alphabetical order to minimize merge conflicts.
- **Value sets: default to a structural string union or `as const` array over an `enum`.** For a fixed set of named values, use a union (`type Status = "active" | "inactive"`); when the values are also needed at runtime (validation, iteration) use an `as const` array and derive the type (`const STATUSES = ["active", "inactive"] as const; type Status = (typeof STATUSES)[number]`). Both stay **structural**, so values that cross a serialization boundary — Firebase documents, API payloads, query params — assign without a cast, and they emit ~no runtime. Reserve an `enum` for **internal-only** state you iterate as a unit and never serialize raw: a string `enum` is **nominal** (it rejects the underlying literal, forcing a cast at every serialization boundary) and a plain `enum` ships a runtime object (`const enum` is unavailable under `isolatedModules`). The deciding question is the serialization boundary — does the value cross a wire/persistence boundary? → structural union / `as const`; an internal-only set you iterate? → an `enum` is fine. Export new unions / `as const` arrays from the module barrel (the directory-level `index.ts` when one exists or is required by the barrel rule above).

## Naming Conventions

- **Firebase schema conversions**: `{domain}ToFirebase()` / `firebaseTo{Domain}()`.
- **Redux slices**: File suffix `-slice.ts`.
- **Presentational views**: Components extracted for testability use the `{Component}View` suffix.

## User-Facing Text

- For any new or modified UI component, store user-facing strings in a co-located copy file
  (e.g., `ComponentName.copy.ts` or `copy.ts`) for internationalization (i18n) readiness.
  Do not introduce new hardcoded display strings inline in components you are actively changing.

  Existing hardcoded strings elsewhere in the codebase are technical debt to be migrated over
  time; this rule does not require unrelated cleanup.

- Copy files export a single `as const` object named `{SCOPE}_COPY` (e.g., `HOME_PAGE_COPY`, `USER_PROFILE_COPY`).

## Documentation

- Keep documentation in sync with the code — outdated docs are worse than no docs.
- Reference pages for scripts and subsystems live under `docs/`, structured to Google's
  Open Knowledge Format (OKF) — one markdown file per script or subsystem, each with YAML
  frontmatter. See [`docs/README.md`](docs/README.md) for the index, the `type` vocabulary
  (`Script`, `Subsystem`, `Index`), and the frontmatter shape.
- When you add or non-trivially change a script under `scripts/` or a subsystem, add or update
  its `docs/` page in the same PR, including the OKF frontmatter (`type` is required; `title`,
  `description`, `resource`, and `tags` are recommended). Cross-link related pages with plain
  markdown links.

## React / Next.js Standards

### Framework

- Next.js with App Router (not Pages Router).
- UI components: ShadCN UI. Do not install other component libraries.
- Styling: Tailwind CSS (comes with ShadCN). No CSS modules or styled-components.

### Client Components

- `"use client"` directive required on all React client components (Next.js App Router).
- React hooks must be called unconditionally — hooks before any early returns.

### JSX

- **No imperative logic inside JSX.** Imperative logic means anything that requires a statement rather than an expression: `const`/`let` declarations, `if`/`switch` blocks, loops, or any sequence of statements that produces a result through side effects. All such logic must live in the component body before the `return` statement, or be extracted into a child component. Expressions of any complexity are permitted directly in JSX — ternaries, logical operators (`&&`, `||`, `??`), method chains (`.map()`, `.filter()`, `.find()`), nested function calls, and template literals are all fine as long as they form a single expression with no intermediate bindings. Multi-statement callback functions passed as JSX props (e.g. `onChange={(e) => { setValue(e.target.value); setError(undefined); }}`) are permitted — the prohibition targets imperative logic in JSX structure, not callback bodies.

### Component Structure

- Components should have a single JSX return statement. Invalid states should be prevented by the type system or guarded against by the calling component. An early `return null` can be acceptable if the invalid state is infeasible for the parent component to detect, but the component itself should be returned as a single JSX block.

## Storybook

- Story files are co-located with their component: `ComponentName.stories.tsx`.
- When adding or modifying a UI component, add or update its Storybook story to cover key visual states.
- Stories should use mock data fixtures — never import from Firebase or depend on runtime providers (QueryClient, Redux store, Next.js router).
- Components that are too hook-dependent to render in isolation should use a presentational split: extract rendering into a `ComponentNameView` that accepts callbacks, and keep the original as a thin wrapper that wires up hooks.

## Component Tests

- Test files are co-located with their component: `ComponentName.spec.tsx`.
- When adding or modifying a UI component, add or update its test to verify rendering behavior and key prop-driven states.
- Use `@testing-library/react` with `vitest`. Always call `afterEach(cleanup)`.
- Do not use `.toBeInTheDocument()` — use `.toBeDefined()` or check `.textContent` instead.
- Assert against copy constants (e.g., `HOME_PAGE_COPY`) rather than hardcoded strings.
- Test presentational view components directly; avoid mocking hooks in tests where possible.

## Testing Conventions

- Use `describe`/`it` from Vitest (not `test`).
- Test fixture generators use `make{DomainName}()` (e.g., `makeUser()`, `makeSession()`).
- When splitting large test files, organize into `{module}-tests/` directories.

### Test Design

- **Control inputs and outputs.** Do not rely on a function's default return values as the assertion of a test unless the purpose of the test is specifically to verify those defaults. Use explicit, non-default values so a passing test proves the value was produced by logic, not inherited from an initializer.
- **One reason to fail per test.** Each test should assert a single logical outcome. Helper functions are fine, but if a test invokes two functions from the codebase it should be explicitly testing how those two interact. Incidental coverage of a second function is not a reason to combine assertions.
- **Keep tests simple.** A failing test should make it immediately obvious whether the failure is a bug or an intentional change in behavior. If understanding a failure requires reading more than one layer of test setup or multiple assertions, split the test.
- **Granularity scales with level of abstraction.** Low-level functions (pure utilities, serializers) warrant thorough edge-case coverage. High-level functions (service orchestration) should have smoke tests that verify they correctly apply the lower-level logic — not re-test every edge case that belongs in the lower-level tests.

## GitHub Issues

- When picking the next task from a milestone, use `gh issue list --milestone "<milestone title>" --state open`.

## Git Conventions

- Branch names: lowercase with hyphens, prefixed by type: `feature/`, `chore/`, `refactor/`, `docs/`, with issue number suffix (e.g., `feature/user-profile-42`).
- Commit messages: imperative verbs (Add, Implement, Fix, Update, Extract, Remove). No `feat:`/`fix:` prefixes.
- PR titles must follow Conventional Commits format: `<type>: description` or `<type>(<scope>): description`. Valid types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`, `ci`, `build`, `revert`. A `!` suffix is allowed before the colon to denote breaking changes (e.g., `feat!: remove legacy auth`). This is enforced by CI.
- PR descriptions must use `Closes #123`, `Fixes #123`, or `Resolves #123` to trigger GitHub's automatic issue close on merge. Phrases like "Addresses #123" or "Related to #123" do NOT trigger auto-close.
