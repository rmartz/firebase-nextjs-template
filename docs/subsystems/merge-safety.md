---
type: Subsystem
title: merge-safety
description: An advisory CI check that surfaces "must this PR be brought current against its base before merge?" by consuming ai-tools' published @rmartz/pr-review CLI — a proof-of-concept for conditional up-to-date merge gating.
resource: .github/workflows/merge-safety.yml
tags: [ci, github-actions, merge, pr-review, poc]
---

# merge-safety

A **proof-of-concept** CI check that answers, per PR: _is this safe to merge as it
stands, or must it first be brought current against its base and re-run through
CI?_ The verdict is posted as a `merge-safety` check-run (and reconciled as
labels) so it is visible on the PR and can act as a required status.

The whole judgment lives in the `evaluateMergeSafety` predicate published in
[`@rmartz/pr-review`](https://github.com/rmartz/ai-tools/blob/main/docs/packages/merge-safety.md)
(the `ai-merge-safety` CLI). **This repo _consumes_ that CLI — it does not
re-implement the predicate**, so there is one source of truth and no drift. The
workflow only installs the pinned CLI, provides git context, and lets the tool
gather facts, post the check-run, and reconcile labels.

This is a hand-rolled stopgap (issue #233) ahead of golden-workflow distribution
(ai-tools#188), so [`merge-safety.yml`](../../.github/workflows/merge-safety.yml)
is intentionally kept close to ai-tools' own workflow shape.

## The predicate

A PR **must be brought current** when it is **not** already current **and** any of:

1. a **breaking** commit landed on the base since the PR's merge-base, or
2. a **`ci`-typed** commit landed on the base since merge-base, or
3. the PR is **itself** breaking (`!` title marker or `breaking change` label), or
4. the PR's changed files **intersect** the files changed on the base since
   merge-base.

Clause 4 is a **narrowing** guard — it only ever forces _more_ PRs current. Git
can merge two diffs cleanly and still produce invalid code (an earlier PR deletes
a symbol this PR uses), so any file-level overlap forces a rebase + re-CI. A hard
git **conflict** is folded in as a separate axis with its own label.

## The workflow

[`.github/workflows/merge-safety.yml`](../../.github/workflows/merge-safety.yml)
has two paths:

- **`pull_request`** (opened / synchronize / reopened / edited / labeled /
  unlabeled) and **`workflow_dispatch`** → the **`evaluate`** job resolves one
  PR's check-run.
- **`push` to `main`** → the **`invalidate`** job flips every _other_ open PR's
  check to **pending** and dispatches that PR's own evaluate run, so a moved base
  holds a PR's verdict until it re-clears against the new base.

The `evaluate` job checks out the **trusted base (`main`), not the PR**: a gate
must apply merged logic, never run PR-authored build scripts under its
write-scoped token. The PR is consumed purely as git data — the job fetches
`pull/<n>/head` with full history so `merge-base`/diffs resolve even on the
dispatched path.

### Consuming vs. building (the key difference from ai-tools)

ai-tools' own workflow **builds** the CLI from monorepo source; this repo
**installs** the published `@rmartz/pr-review` package pinned by the
`PR_REVIEW_VERSION` env (currently `0.4.0` — the version with `evaluate`,
`invalidate`, and `--json`). `git` and `gh` are pre-installed on the runner, so
the jobs only need Node plus the global CLI install.

## Private-package auth

`@rmartz/pr-review` is a **private GitHub Packages** package published from
`rmartz/ai-tools`. The workflow authenticates with the built-in `GITHUB_TOKEN`
via `permissions: packages: read` (no long-lived PAT secret) —
`actions/setup-node` writes the scoped `@rmartz` registry `.npmrc` and
`npm install -g` reads `NODE_AUTH_TOKEN`.

Because both repos share the **same owner** (`rmartz`), the consumer's
`GITHUB_TOKEN` reads the package directly — no extra grant was needed here
(verified: the check ran green on the PR that introduced it). If a consumer repo
ever hits a `401` on the `Install ai-merge-safety CLI` step (a different owner, or
stricter package visibility), grant it read access in **ai-tools → Packages →
`@rmartz/pr-review` → Package settings → Manage Actions access** by adding the
repository with **Read**. Verify locally with `npm view @rmartz/pr-review version`
(needs a `read:packages` token).

This cross-repo access is the crux ai-tools#188 must standardize when it
distributes the workflow to repos beyond this owner's.

## Labels (visibility)

- **`update required`** — the staleness verdict (`needsUpdate`).
- **`merge conflict`** — `gh` reports the PR as `CONFLICTING`.

Each run reconciles both — adding the labels that apply and removing the ones that
no longer do — so a PR that a rebase makes safe is cleared automatically. Both
labels must exist in the repo (seeded once via `gh label create`); ai-tools#188
will add them to the bootstrap roster.

## This repo's posture — advisory, not a gate

`merge-safety` is **advisory** here. This repo has no PR Shepherd coordinator; it
relies on GitHub's native auto-merge, and there is no serialized merge actor to
close the check's inherent race. Making it a **required** status is possible
(Settings → Branches → require the `merge-safety` status), but read the TOCTOU
limitation first.

### Known limitation — the TOCTOU window (why this is a POC)

GitHub has **no synchronous pre-merge admission hook**, so a required check is
evaluated against its **last posted state**. Between PR-A merging (base moves) and
the `invalidate` job actually starting (runner cold-start, tens of seconds),
PR-B's check is still green and its auto-merge can fire on that stale pass. The
`invalidate` path shrinks — but cannot eliminate — this window. Without a
cooperating serialized merge actor, treat this check as **externalized visibility
and defense-in-depth**, not the sole gate arbitrary auto-merges race against.

## Dependabot

The check flags Dependabot PRs too, but Dependabot self-rebases, so an `update
required` there clears itself. This workflow leaves them in (matching ai-tools'
shape); to cut noise you can gate the `evaluate` job with
`if: github.actor != 'dependabot[bot]'`.
