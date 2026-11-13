---
type: Subsystem
title: merge-safety
description: The required `merge-safety` check that holds a PR's auto-merge until it is safe against the current base — a thin caller that runs the shared rmartz/merge-safety-action composite action, pinned by SHA and bumped by Dependabot.
resource: .github/workflows/merge-safety.yml
tags: [ci, github-actions, merge, auto-merge]
---

# merge-safety

The `merge-safety` check answers, per PR: _is this safe to merge as it stands, or
must it first be brought current against its base and re-run through CI?_ It posts
the verdict as a `merge-safety` check-run and commit status, which this repo
requires on `main`. A PR's auto-merge therefore waits until the check clears.

The whole judgment lives in [`rmartz/merge-safety`](https://github.com/rmartz/merge-safety),
which publishes the `@rmartz/merge-safety` package (the `merge-safety` CLI), and in
[`rmartz/merge-safety-action`](https://github.com/rmartz/merge-safety-action), the
composite action that runs it. **This repo runs that action as a step. It does not
re-implement the verdict**, so there is one source of truth and no drift. See
[what merge-safety is](https://github.com/rmartz/merge-safety/blob/main/docs/overview.md)
for the facts it gathers and how it decides.

## The caller workflow

[`.github/workflows/merge-safety.yml`](../../.github/workflows/merge-safety.yml) is
the thin caller described in
[merge-safety-action's consuming guide](https://github.com/rmartz/merge-safety-action/blob/main/docs/consuming.md).
A composite action runs as a step inside the caller's own job, so the caller owns
the triggers, the job's `if:` filter, its concurrency group, and the write
permissions. The `if:` filter skips, without a runner, events the action would
ignore: another app's check suite, a non-default branch's suite, a tag push, and a
branch deletion. The job runs the action once per event, and the action picks its
mode from the event:

- **`pull_request_target`** (opened / synchronize / reopened / edited / labeled /
  unlabeled) and **`workflow_dispatch`** (with a `pr` input) → **evaluate**
  resolves one PR's verdict. The caller uses `pull_request_target`, not
  `pull_request`, because GitHub dispatches no `pull_request` run for an
  unmergeable PR. On a conflicting PR the required check would never appear and
  the PR would hang. This is safe because the action checks out the base ref,
  fetches the PR head only as git data, and runs the published CLI. It never runs
  PR code. Each evaluate run gets its own concurrency group (keyed on `run_id`),
  so a burst of PR events neither queues nor cancels a run.
- **`push` to `main`** and **`check_suite` completed** → **invalidate** flips
  every other open PR's check back to pending and re-dispatches each one's
  evaluate. A moved base, or a base whose own CI flips red or green, holds
  each PR until it re-clears. Invalidate runs serialize per branch and are never
  cancelled.

## Staying current

The caller pins the action by commit SHA with a `# vX.Y.Z` comment. Dependabot's
`github-actions` ecosystem opens PRs to bump that pin, which reads
`rmartz/merge-safety-action`. Each action release pins a specific
`@rmartz/merge-safety` version in its lockfile, so the pinned SHA fully determines
the behavior and a pin bump is the only change needed to pick up a new merge-safety
release.

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
