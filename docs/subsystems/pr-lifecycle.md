---
type: Subsystem
title: pr-lifecycle
description: The shared @rmartz/pr-lifecycle reconciler, run without arming via rmartz/pr-lifecycle-action, which keeps each PR's lifecycle and UAT labels in step with its current facts and posts the pr-lifecycle/sign-off status.
resource: .github/workflows/pr-lifecycle.yml
tags: [ci, github-actions, pr-lifecycle, labels, uat]
---

# pr-lifecycle

[`.github/workflows/pr-lifecycle.yml`](../../.github/workflows/pr-lifecycle.yml)
runs [`rmartz/pr-lifecycle-action`](https://github.com/rmartz/pr-lifecycle-action)
on every relevant PR event: opens, pushes, labels, reviews, review requests, and
CI completing. Each run recomputes the PR's lifecycle state from its current
facts and converges its labels (`approved`, `changes requested`, `blocked`,
`fix required`, `ci failing`, …).

**UAT.** With `uat: 'on'` it keeps exactly one of `no UAT needed`,
`UAT pending`, `UAT ready`, or `UAT passed` on each PR. The
[pr-policy](pr-policy.md) gate reads the sign-off status this posts.

**No arming.** `arm-auto-merge` is off, so it never arms, merges, or updates a
branch. It posts the `pr-lifecycle/sign-off` status with the App token, and the
[pr-policy](pr-policy.md) gate trusts it from `rmartz-merge-bot[bot]`. `bot-automerge.yml` still
merges eligible bot PRs. Reads and label writes use the same App token.

**Triggers.** It runs on `pull_request_target` and never checks out PR code.
`workflow_run` lists the workflows behind the required checks (`CI`,
`Storybook Tests`, `pr-policy`); keep it in step if a required check moves.

The caller follows the action's
[consumer guide](https://github.com/rmartz/pr-lifecycle-action/blob/main/docs/consuming.md).
