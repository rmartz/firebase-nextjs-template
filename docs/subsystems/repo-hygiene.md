---
type: Subsystem
title: Repo hygiene
description: The shared @rmartz/repo-hygiene quality gates (conflict markers, action and package.json pins, AGENTS/CLAUDE pairing, OKF frontmatter, file caps) and how they are wired into commits and CI.
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

Seven checks are enabled, named explicitly in both the CI workflow and the
`hygiene` scripts — the package's default set is only `conflict-markers` +
`action-pins`, so the rest are opt-in. Configuration lives in
[`.repo-hygiene.yml`](../../.repo-hygiene.yml):

| Check              | Enforces                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `conflict-markers` | No merge-conflict markers in tracked/staged content.                                                             |
| `action-pins`      | Every GitHub Action pinned to a commit SHA with a full-semver comment.                                           |
| `package-pins`     | Every `package.json` dependency pinned to a full `[major].[minor].[patch]` base (a `^`/`~` operator is fine).    |
| `md-pairing`       | `AGENTS.md` and `CLAUDE.md` travel together as real files (not symlinks).                                        |
| `okf`              | OKF frontmatter conformance for `docs/` content pages.                                                           |
| `okf-index`        | `docs/` index-tree navigability: every directory has an `index.md` that links its content pages and sub-indexes. |
| `file-caps`        | Per-glob line-size caps (born-green, no baseline).                                                               |

Only `okf` (the `Script` / `Subsystem` vocabulary, the docs roots, and the
`index.md` exemptions) and `file-caps` (the ordered per-glob caps) need
settings; the other five run on their defaults.

## Wiring

- **Package scripts** — `pnpm run hygiene` (all tracked files) and
  `pnpm run hygiene:staged` (the commit-time scan over staged blobs). Both name
  the enabled checks explicitly and pass `--config .repo-hygiene.yml` — the
  package's bare default would run only `conflict-markers` + `action-pins`.
- **Pre-commit** — `.husky/pre-commit` (human commits) and
  `claude/hooks/pre-commit` (agent commits in worktrees) both run
  `pnpm run hygiene:staged`.
- **CI** — [`repo-hygiene.yml`](../../.github/workflows/repo-hygiene.yml) runs
  the [`rmartz/repo-hygiene-action`](https://github.com/rmartz/repo-hygiene-action)
  composite Action (SHA-pinned, kept current by Dependabot's github-actions
  ecosystem), which installs its own pinned CLI and runs it over all tracked
  files. CI needs no local devDependency; the devDependency backs only the local
  scripts and the pre-commit run. Action releases before v3.0.0 bundle a CLI
  older than 7.0.0, which exits 0 without running any check when launched
  through a symlink ([rmartz/repo-hygiene#67](https://github.com/rmartz/repo-hygiene/issues/67)),
  so never pin below v3.0.0.

## Installing the package

`@rmartz/repo-hygiene` is public on npmjs, so `pnpm install` needs no token,
locally or in CI. [`.npmrc`](../../.npmrc) pins the `@rmartz` scope to npmjs
explicitly, so a user-level `.npmrc` that maps `@rmartz` to GitHub Packages
(still used by other `@rmartz` packages) can't redirect the install. Versions up
to 7.0.1 were also published to GitHub Packages; newer ones exist only on npmjs.

## Consolidation status

This template previously enforced several of these rules with bespoke scripts
under `scripts/`; those were retired in favor of the shared package. The
`okf-index` check (added in `@rmartz/repo-hygiene` v1.0.0) is the centralized
port of the old `validate-docs-index.mjs`, closing the index-navigability gap.
A couple of rules the old scripts covered are not yet centralized — tracked as
enhancement issues so that adopting them is a dependency bump, not a re-port:

- OKF optional field-family validation — [rmartz/ai-tools#202](https://github.com/rmartz/ai-tools/issues/202)
- `md-pairing` bare `@AGENTS.md` wrapper content — [rmartz/ai-tools#203](https://github.com/rmartz/ai-tools/issues/203)

`package-pins` replaced the old `validate-pins.mjs` ([rmartz/ai-tools#315](https://github.com/rmartz/ai-tools/issues/315)).
Unlike the old script it scans only `dependencies` / `devDependencies`, not
`optionalDependencies` / `peerDependencies`; this repo has neither, so nothing
is lost today.

## Related

- [The OKF documentation format](../okf-format.md) — the frontmatter the `okf` check validates.
