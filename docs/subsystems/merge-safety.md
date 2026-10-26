---
type: Subsystem
title: merge-safety
description: The required `merge-safety` check that holds a PR's auto-merge until it is safe against the current base, posted by the hosted rmartz-pr-lifecycle-gate GitHub App (no workflow in this repo).
tags: [ci, github-app, merge, auto-merge]
---

# merge-safety

The `merge-safety` check answers, per PR: _is this safe to merge as it stands, or
must it first be brought current against its base and re-run through CI?_ It posts
the verdict as a `merge-safety` check-run and commit status, which this repo
requires on `main`. A PR's auto-merge therefore waits until the check clears.

The whole judgment lives in [`rmartz/merge-safety`](https://github.com/rmartz/merge-safety),
the `@rmartz/merge-safety` package. See
[what merge-safety is](https://github.com/rmartz/merge-safety/blob/main/docs/overview.md)
for the facts it gathers and how it decides.

## Who runs it

This repo has **no merge-safety workflow**. The check is posted by the hosted
`rmartz-pr-lifecycle-gate` GitHub App, the gate role of
[`rmartz/pr-lifecycle-app`](https://github.com/rmartz/pr-lifecycle-app), which runs
the library with its API-backed fact source, so no checkout is needed. Its
settings for this repo live in the App's
[`src/repos.ts`](https://github.com/rmartz/pr-lifecycle-app/blob/main/src/repos.ts).
The branch ruleset requires `merge-safety` from the gate App (integration 5460238),
so only the App's key can satisfy it.

The App reacts to:

- **A PR change** (opened / synchronize / reopened, a title edit, or the `hotfix`
  label) → **evaluate** resolves that PR's verdict. It works on conflicting and
  fork PRs alike, since a webhook needs no runnable merge commit.
- **A push to a branch, or the default branch's push-started CI completing** →
  **invalidate** marks the open PRs on that branch pending and re-evaluates them in
  place, at most four at a time. A PR whose verdict already reflects the current
  base (its tip and which required checks are failing) is skipped.
- **Re-run** on the `merge-safety` check → re-evaluates that PR.

Details: [the gate role](https://github.com/rmartz/pr-lifecycle-app/blob/main/docs/gate.md).

## Labels

- **`update required`**: the PR must be brought current against its base.
- **`merge conflict`**: the PR conflicts with its base.

Each evaluation reconciles both. It adds the labels that apply and removes the
ones that no longer do, so a PR that a rebase makes safe is cleared automatically.

## Known limitation: the TOCTOU window

GitHub has **no synchronous pre-merge admission hook**, so a required check is
evaluated against its **last posted state**. Between PR-A merging (the base moves)
and the App marking PR-B pending (a webhook round trip, typically seconds),
PR-B's check is still green, and its auto-merge can fire on that stale pass. The
invalidation shrinks this window but cannot eliminate it. This repo has no
serialized merge actor to close it, so treat the check as defense-in-depth rather
than a perfect gate.
