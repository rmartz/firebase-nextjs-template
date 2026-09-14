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

All five shipped checks run by default (the CLI runs every builtin when none is
named). Configuration lives in [`.repo-hygiene.yml`](../../.repo-hygiene.yml):

| Check              | Enforces                                                                  |
| ------------------ | ------------------------------------------------------------------------- |
| `conflict-markers` | No merge-conflict markers in tracked/staged content.                      |
| `action-pins`      | Every GitHub Action pinned to a commit SHA with a full-semver comment.    |
| `md-pairing`       | `AGENTS.md` and `CLAUDE.md` travel together as real files (not symlinks). |
| `okf`              | OKF frontmatter conformance for `docs/` content pages.                    |
| `file-caps`        | Per-glob line-size caps (born-green, no baseline).                        |

Only `okf` (the `Script` / `Subsystem` vocabulary, the docs roots, and the
`index.md` exemptions) and `file-caps` (the ordered per-glob caps) need
settings; the other three run on their defaults.

## Wiring

- **Package scripts** — `pnpm run hygiene` (`ai-repo-hygiene --check`, the CI
  backstop over all tracked files) and `pnpm run hygiene:staged`
  (`ai-repo-hygiene --staged`, the commit-time scan over staged blobs).
- **Pre-commit** — `.husky/pre-commit` (human commits) and
  `claude/hooks/pre-commit` (agent commits in worktrees) both run
  `ai-repo-hygiene --staged`.
- **CI** — the **Hygiene** job in
  [`ci-actions.yml`](../../.github/workflows/ci-actions.yml) runs
  `pnpm run hygiene`.

## GitHub Packages authentication

`@rmartz/repo-hygiene` publishes to GitHub Packages, so `pnpm install` must
authenticate wherever it runs. [`.npmrc`](../../.npmrc) points the `@rmartz`
scope at `npm.pkg.github.com` and reads a `NODE_AUTH_TOKEN`:

- **Locally**: `NODE_AUTH_TOKEN=$(gh auth token) pnpm install` (see
  [CONTRIBUTING.md](../../CONTRIBUTING.md)).
- **In CI**: the job's `GITHUB_TOKEN` with `permissions: packages: read`.

## Consolidation status

This template previously enforced several of these rules with bespoke scripts
under `scripts/`; those were retired in favor of the shared package. A few rules
the old scripts covered are not yet in the centralized checks — tracked as
enhancement issues so that adopting them is a dependency bump, not a re-port:

- OKF optional field-family validation — [rmartz/ai-tools#202](https://github.com/rmartz/ai-tools/issues/202)
- OKF index-tree navigability + index-page frontmatter rules — [rmartz/ai-tools#200](https://github.com/rmartz/ai-tools/issues/200)
- `md-pairing` bare `@AGENTS.md` wrapper content — [rmartz/ai-tools#203](https://github.com/rmartz/ai-tools/issues/203)

## Related

- [The OKF documentation format](../okf-format.md) — the frontmatter the `okf` check validates.
- [validate-pins.mjs](../scripts/validate-pins.md) — the complementary `package.json` full-version pin check (not part of repo-hygiene).
