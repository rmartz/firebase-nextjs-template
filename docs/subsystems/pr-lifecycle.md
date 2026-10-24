---
type: Subsystem
title: pr-lifecycle
description: The shared @rmartz/pr-lifecycle reconciler, run without arming by the hosted rmartz-pr-lifecycle GitHub App (no workflow in this repo), which keeps each PR's lifecycle and UAT labels in step with its current facts and posts the pr-lifecycle/sign-off status.
tags: [ci, github-app, pr-lifecycle, labels, uat]
---

# pr-lifecycle

This repo has **no pr-lifecycle workflow**. The reconciler runs as the hosted
`rmartz-pr-lifecycle` GitHub App,
[`rmartz/pr-lifecycle-app`](https://github.com/rmartz/pr-lifecycle-app). The App
receives this repo's webhooks: opens, pushes, labels, reviews, review requests,
and CI completing. For each one it recomputes the PR's lifecycle state from its
current facts and converges its labels (`approved`, `changes requested`,
`blocked`, `fix required`, `ci failing`, …). The App's policy for this repo
lives in its
[`src/repos.ts`](https://github.com/rmartz/pr-lifecycle-app/blob/main/src/repos.ts),
so changing it is a PR there, not here.

**UAT.** With UAT on, it keeps exactly one of `no UAT needed`, `UAT pending`,
`UAT ready`, or `UAT passed` on each PR. The [pr-policy](pr-policy.md) gate
reads the sign-off status it posts.

**No arming.** Arming is off, so it never arms, merges, or updates a branch.
`bot-automerge.yml` still merges eligible bot PRs. It posts the
`pr-lifecycle/sign-off` status as `rmartz-pr-lifecycle[bot]`, which the
[pr-policy](pr-policy.md) gate trusts.

**Label writes start workflows.** The App writes labels with its installation
token, so each lifecycle label it adds fires this repo's `labeled` workflows:
pr-policy, merge-safety, bot-automerge, and the preview deploy on `UAT ready`.

**Approval carry-over is off.** The App doesn't verify clean rebases yet, so
after a rebase (including a Dependabot rebase) a PR needs a fresh review. See
the App's
[proof-of-concept simplifications](https://github.com/rmartz/pr-lifecycle-app/blob/main/docs/server.md#proof-of-concept-simplifications).
