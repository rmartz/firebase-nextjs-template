---
type: Subsystem
title: pr-policy
description: The shared @rmartz/pr-policy PR content checks, run via rmartz/pr-policy-action on pull_request_target — this repo was the fleet pilot, keeps the UAT gate as a Next.js app, and relies on pr-policy's title check in place of the retired pr-title-lint.yml.
resource: .github/workflows/pr-policy.yml
tags: [ci, github-actions, pr-policy, uat]
---

# pr-policy

[`.github/workflows/pr-policy.yml`](../../.github/workflows/pr-policy.yml) runs
[`rmartz/pr-policy-action`](https://github.com/rmartz/pr-policy-action), which
wraps the [`@rmartz/pr-policy`](https://github.com/rmartz/pr-policy) library. It
reads the PR's title, labels, and changed files through the API, then posts the
blocking **`pr-policy`** verdict and reconciles the labels it owns. This repo
**consumes** the action; it does not re-implement any policy.

## What it checks

The checks, and what makes each one red or pending, are listed in
[pr-policy's check docs](https://github.com/rmartz/pr-policy/blob/main/docs/checks/index.md).
The version in force is the one bundled by the pinned action. In short: red
means the author has something to fix (a bad title, for example), and pending
means a person has to act.

**This repo keeps the UAT gate**, because it is a Next.js app with something to
user-test. A PR stays pending until it carries `no UAT needed` (the review
agent's call) or a person's `UAT passed`. The caller must not set `skip-uat`.

The verdict is posted twice: as the `pr-policy` check-run and as a `pr-policy`
commit status. The status keeps the merge gate working when GitHub supersedes
the check suite the check-run landed in. The action also posts one
informational status per check (`pr-policy / title`, `pr-policy / uat`, …). All
of these need the workflow's `statuses: write`.

**The `status` trigger.** pr-policy gates UAT and CI sign-off on pr-lifecycle's
`pr-lifecycle/sign-off` commit status once a head carries one, so the caller
also re-runs on `status`, filtered to that context. [pr-lifecycle](pr-lifecycle.md) posts it with the
`rmartz-pr-lifecycle` App token, which the caller trusts by default
(`sign-off-status-creators`). pr-policy falls back to its own classification only
while a head has no status.

**The UAT label is required.** With `require-uat-label: true`, pr-policy holds a PR
that carries no UAT label, so every merge has an explicit UAT determination.
pr-lifecycle writes that label with `GITHUB_TOKEN`, which starts no `labeled` run, so
the caller also re-runs when the `pr-lifecycle` workflow completes (`workflow_run`).

## PR titles — pr-title-lint retired

This repo was the fleet pilot for pr-policy. The switch-over is done: the
per-repo `pr-title-lint.yml` is retired, and PR titles are checked by
pr-policy's `title` check, part of the required `pr-policy` check
(rmartz/ai-tools#312).

## Why `pull_request_target`

Under `pull_request`, fork and Dependabot PRs get a read-only token and could not
write the check-run, status, or label. `pull_request_target` runs with a
base-context write token, which is safe only because the workflow never checks
out or runs PR code. The job is named `pr-policy (evaluate)` so it does not
collide with the `pr-policy` check-run and status.

## Related

- [merge-safety](merge-safety.md) — the other consumed PR-evaluation CLI.
- [Repo hygiene](repo-hygiene.md) — the shared file-content gates.
