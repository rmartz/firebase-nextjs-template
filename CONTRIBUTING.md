# Contributing

Guidelines for contributing to projects built from this template.

## Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+

## Setup

This project depends on [`@rmartz/repo-hygiene`](https://github.com/rmartz/ai-tools),
published to GitHub Packages, so `pnpm install` must authenticate. Provide a
`NODE_AUTH_TOKEN` with `read:packages` scope — the simplest source is your `gh`
token:

```bash
NODE_AUTH_TOKEN=$(gh auth token) pnpm install
cp .env.example .env.local  # Fill in your Firebase credentials
pnpm dev
```

Alternatively, add the token to your global `~/.npmrc` so plain `pnpm install`
works:

```
//npm.pkg.github.com/:_authToken=<a token with read:packages>
```

## Development Workflow

1. Create a branch from `main` using the naming convention:

   ```
   feature/description-123
   chore/description-123
   refactor/description-123
   docs/description-123
   ```

   Where `123` is the issue number.

2. Make your changes following the conventions in [AGENTS.md](AGENTS.md).

3. Run checks locally before pushing:

   ```bash
   pnpm lint
   pnpm format:check
   pnpm test
   pnpm build
   pnpm run hygiene
   ```

4. Push your branch and open a PR against `main`.

## Pre-commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) with [lint-staged](https://github.com/lint-staged/lint-staged) to run checks on staged files before each commit:

- **ESLint** — Lints and auto-fixes `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs` files
- **Prettier** — Formats `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.json`, `.md`, `.yml`, `.yaml` files
- **Repo hygiene** — `@rmartz/repo-hygiene` gates over staged content: merge-conflict markers, GitHub Action SHA pins, `AGENTS.md`/`CLAUDE.md` pairing, OKF frontmatter, and file-size caps

If a pre-commit hook fails, fix the issues and try committing again.

## Code Standards

See [AGENTS.md](AGENTS.md) for the full list of code conventions, including:

- TypeScript strict mode, no `any` types
- Named exports (except Next.js pages and Redux slices)
- Co-located test files (`Component.spec.tsx`) and stories (`Component.stories.tsx`)
- User-facing strings in co-located copy files for i18n readiness
- File size limits (~200 lines for source, ~300 lines for tests)

## Commit Messages

Use imperative verbs: **Add**, **Implement**, **Fix**, **Update**, **Extract**, **Remove**.

No `feat:`/`fix:` conventional commit prefixes.

## CI Checks

Every PR runs several parallel checks via GitHub Actions:

| Check        | Command / mechanism                                                    | Must Pass           |
| ------------ | ---------------------------------------------------------------------- | ------------------- |
| Tests        | `pnpm test`                                                            | Yes                 |
| Lint         | `pnpm lint`                                                            | Yes (zero warnings) |
| Format       | `pnpm format:check`                                                    | Yes                 |
| Build        | `pnpm build`                                                           | Yes                 |
| Repo Hygiene | `@rmartz/repo-hygiene` reusable workflow (locally: `pnpm run hygiene`) | Yes                 |

## Storybook

When adding or modifying UI components:

1. Add or update a co-located story (`ComponentName.stories.tsx`)
2. Use mock data — never depend on Firebase or runtime providers
3. For hook-dependent components, use the presentational split pattern: extract a `ComponentNameView` that accepts callbacks

Run Storybook locally:

```bash
pnpm storybook
```

## Testing

- Use `vitest` with `@testing-library/react`
- Co-locate tests with source files
- Use `describe`/`it` (not `test`)
- Use `make{Domain}()` factory functions for test fixtures
- Assert against copy constants, not hardcoded strings

Run tests:

```bash
pnpm test
```
