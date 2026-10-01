---
type: Subsystem
title: merge-safety
description: The required `merge-safety` check that holds a PR's auto-merge until it is safe against the current base — a thin caller of the shared rmartz/merge-safety reusable workflow, pinned by SHA and bumped by Dependabot.
resource: .github/workflows/merge-safety.yml
tags: [ci, github-actions, merge, auto-merge]
---

# merge-safety

The `merge-safety` check answers, per PR: _is this safe to merge as it stands, or
must it first be brought current against its base and re-run through CI?_ It posts
the verdict as a `merge-safety` check-run and commit status, which this repo
requires on `main`. A PR's auto-merge therefore waits until the check clears.

The whole judgment lives in [`rmartz/merge-safety`](https://github.com/rmartz/merge-safety),
which publishes the `@rmartz/merge-safety` package (the `merge-safety` CLI) and the
reusable workflow that runs it. **This repo consumes that workflow. It does not
re-implement the verdict**, so there is one source of truth and no drift. See
[what merge-safety is](https://github.com/rmartz/merge-safety/blob/main/docs/overview.md)
for the facts it gathers and how it decides.

## The caller workflow

[`.github/workflows/merge-safety.yml`](../../.github/workflows/merge-safety.yml) is
the thin caller described in
[merge-safety's consuming guide](https://github.com/rmartz/merge-safety/blob/main/docs/consuming.md).
A reusable workflow can't declare its own triggers, so the caller carries them and
grants the write scopes:

- **`pull_request_target`** (opened / synchronize / reopened / edited / labeled /
  unlabeled) and **`workflow_dispatch`** (with a `pr` input) → **`evaluate`**
  resolves one PR's verdict. The caller uses `pull_request_target`, not
  `pull_request`, because GitHub dispatches no `pull_request` run for an
  unmergeable PR. On a conflicting PR the required check would never appear and
  the PR would hang. This is safe because `evaluate` checks out the base ref,
  fetches the PR head only as git data, and runs the published CLI. It never runs
  PR code.
- **`push` to `main`** and **`check_suite` completed** → **`invalidate`** flips
  every other open PR's check back to pending and re-dispatches each one's
  `evaluate`. A moved base, or a base whose own CI flips red or green, holds
  each PR until it re-clears.

## Staying current

The caller pins the reusable workflow by commit SHA with a `# vX.Y.Z` comment.
Dependabot's `github-actions` ecosystem opens PRs to bump that pin. The reusable
workflow installs the CLI version that matches its pinned release tag, so a pin
bump is the only change needed to pick up a new merge-safety release.

## Labels

- **`update required`**: the PR must be brought current against its base.
- **`merge conflict`**: the PR conflicts with its base.

Each run reconciles both. It adds the labels that apply and removes the ones that
no longer do, so a PR that a rebase makes safe is cleared automatically.

## Known limitation: the TOCTOU window

GitHub has **no synchronous pre-merge admission hook**, so a required check is
evaluated against its **last posted state**. Between PR-A merging (the base moves)
and the `invalidate` job starting (runner cold-start, tens of seconds), PR-B's
check is still green, and its auto-merge can fire on that stale pass. The
`invalidate` path shrinks this window but cannot eliminate it. This repo has no
serialized merge actor to close it, so treat the check as defense-in-depth rather
than a perfect gate.
