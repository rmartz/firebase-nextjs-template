---
type: Subsystem
title: Repo hygiene
description: The shared @rmartz/repo-hygiene quality gates (conflict markers, action pins, AGENTS/CLAUDE pairing, OKF frontmatter, file caps) and how they are wired into commits and CI.
resource: .repo-hygiene.yml
tags: [tooling, quality-gates, ci, hygiene]
---

# Repo hygiene

Layer-1 repository quality gates are provided by the shared
[`@rmartz/repo-hygiene`](https://github.com/rmartz/ai-tools/blob/main/docs/packages/repo-hygiene.md)
package rather than by per-repo scripts. One tested implementation runs
everywhere; this template — the fleet's distribution mechanism — ships the
wiring so every generated repo inherits enforcement at zero per-repo setup.

## Checks

Six checks are enabled, named explicitly in both the CI workflow and the
`hygiene` scripts — the package's default set is only `conflict-markers` +
`action-pins`, so the rest are opt-in. Configuration lives in
[`.repo-hygiene.yml`](../../.repo-hygiene.yml):

| Check              | Enforces                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `conflict-markers` | No merge-conflict markers in tracked/staged content.                                                             |
| `action-pins`      | Every GitHub Action pinned to a commit SHA with a full-semver comment.                                           |
| `md-pairing`       | `AGENTS.md` and `CLAUDE.md` travel together as real files (not symlinks).                                        |
| `okf`              | OKF frontmatter conformance for `docs/` content pages.                                                           |
| `okf-index`        | `docs/` index-tree navigability: every directory has an `index.md` that links its content pages and sub-indexes. |
| `file-caps`        | Per-glob line-size caps (born-green, no baseline).                                                               |

Only `okf` (the `Script` / `Subsystem` vocabulary, the docs roots, and the
`index.md` exemptions) and `file-caps` (the ordered per-glob caps) need
settings; the other four run on their defaults.

## Wiring

- **Package scripts** — `pnpm run hygiene` (all tracked files) and
  `pnpm run hygiene:staged` (the commit-time scan over staged blobs). Both name
  the enabled checks explicitly and pass `--config .repo-hygiene.yml` — the
  package's bare default would run only `conflict-markers` + `action-pins`.
- **Pre-commit** — `.husky/pre-commit` (human commits) and
  `claude/hooks/pre-commit` (agent commits in worktrees) both run
  `pnpm run hygiene:staged`.
- **CI** — [`repo-hygiene.yml`](../../.github/workflows/repo-hygiene.yml) calls
  the published [`@rmartz/repo-hygiene`](https://github.com/rmartz/repo-hygiene)
  reusable workflow (SHA-pinned, kept current by Dependabot's github-actions
  ecosystem), which installs and runs the CLI over all tracked files. CI needs
  no local devDependency; the devDependency backs only the local scripts and the
  pre-commit run.

## GitHub Packages authentication

`@rmartz/repo-hygiene` publishes to GitHub Packages, so `pnpm install` must
authenticate wherever it runs. [`.npmrc`](../../.npmrc) points the `@rmartz`
scope at `npm.pkg.github.com` and reads a `NODE_AUTH_TOKEN`:

- **Locally**: `NODE_AUTH_TOKEN=$(gh auth token) pnpm install` (see
  [CONTRIBUTING.md](../../CONTRIBUTING.md)).
- **In CI**: the job's `GITHUB_TOKEN` with `permissions: packages: read`.

## Consolidation status

This template previously enforced several of these rules with bespoke scripts
under `scripts/`; those were retired in favor of the shared package. The
`okf-index` check (added in `@rmartz/repo-hygiene` v1.0.0) is the centralized
port of the old `validate-docs-index.mjs`, closing the index-navigability gap.
A couple of rules the old scripts covered are not yet centralized — tracked as
enhancement issues so that adopting them is a dependency bump, not a re-port:

- OKF optional field-family validation — [rmartz/ai-tools#202](https://github.com/rmartz/ai-tools/issues/202)
- `md-pairing` bare `@AGENTS.md` wrapper content — [rmartz/ai-tools#203](https://github.com/rmartz/ai-tools/issues/203)

## Related

- [The OKF documentation format](../okf-format.md) — the frontmatter the `okf` check validates.
- [validate-pins.mjs](../scripts/validate-pins.md) — the complementary `package.json` full-version pin check (not part of repo-hygiene).
