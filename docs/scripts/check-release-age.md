---
type: Script
title: check-release-age.mjs
description: Fails a PR that introduces a package version younger than the cooldown window (default 7 days).
resource: scripts/check-release-age.mjs
tags: [ci, dependencies, dependabot, supply-chain, security, cooldown]
---

# check-release-age.mjs

A **deterministic dependency-cooldown gate** — a second layer on top of Dependabot's own `cooldown`. It fails a PR that introduces any package version younger than `RELEASE_AGE_MIN_DAYS` (default 7 days), enforcing our "let a release age before we adopt it" supply-chain policy at a layer we control.

## Why a second layer

Dependabot's `cooldown` is advisory at PR-creation time and has [documented reliability gaps for npm](https://github.com/dependabot/dependabot-core/issues/12677): same-day patch walks can merge while each version is only a few days old, well inside the configured window. This gate is deterministic and runs on our CI, so a too-young version can't land regardless of Dependabot's behavior.

**Why not pnpm's `minimum-release-age` in committed config:** that setting makes Dependabot's own lockfile regeneration fetch publish-time metadata for the whole candidate tree on every update — a full-metadata storm that causes multi-minute/hour Dependabot timeouts. This gate never touches Dependabot's resolver; it inspects the _result_ (the lockfile diff) and queries the registry for only the handful of newly-introduced versions.

## Usage

```bash
node scripts/check-release-age.mjs [baseRef]   # baseRef default: origin/main
pnpm run release-age:validate
RELEASE_AGE_MIN_DAYS=14 pnpm run release-age:validate   # override the window
```

It runs in CI as the **Check dependency release age** job (`.github/workflows/release-age.yml`), `pull_request`-only and path-gated to runs that change `pnpm-lock.yaml` or the checker — the gate blocks a hot version from _landing_, so running on `main` would only flag an already-merged commit.

## What it checks

- Diffs the head `pnpm-lock.yaml` against `git show <baseRef>:pnpm-lock.yaml`, collecting `name@version` keys from the lockfile's top-level `packages:` block. Diffing the **lockfile** (not just `package.json`) means fresh **transitive** bumps are caught too.
- For each **newly-introduced** version, queries `registry.npmjs.org` for its publish date and fails if it is younger than the window.
- Non-registry specifiers (private/workspace/tarball) and unresolvable versions are skipped. Registry fetch failures are warned-and-skipped (**fail-open**) so a flaky registry doesn't produce a spurious red build; a confirmed too-young version always fails.

Exits 0 when every newly-introduced version is old enough; exits 1 listing each too-young `name@version` with its age.

## Requires

- `node` + `git` + network (reads the lockfile and queries the registry — no dependency install)

## Follow-ups (POC)

- Make it a **required** status check (branch protection) so it hard-blocks merge.
- The coordinator should **re-run** the check (not close / churn the PR) once a held version ages past the window, so the PR flips green and flows normally.

## Related

- [validate-pins.mjs](validate-pins.md) — full-version pins (a related supply-chain gate).
