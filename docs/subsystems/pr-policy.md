---
type: Subsystem
title: pr-policy
description: The shared @rmartz/pr-policy PR content checks, run via rmartz/pr-policy-action on pull_request_target — this repo is the fleet pilot, keeps the UAT gate as a Next.js app, and is switching pr-policy to a required status in place of pr-title-lint.yml.
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

## Why it is here — the fleet pilot

This repo runs pr-policy first, so problems surface in one repo before every
repo requires the check. It also retires the per-repo `pr-title-lint.yml` in
favour of pr-policy's title check (rmartz/ai-tools#312).

The switch-over: once `pr-policy` has run cleanly on the current pin, require it
in the default-branch ruleset, then delete
[`pr-title-lint.yml`](../../.github/workflows/pr-title-lint.yml) in a
`ci`-typed PR. Until then `pr-title-lint.yml` still gates PR titles.

## Why `pull_request_target`

Under `pull_request`, fork and Dependabot PRs get a read-only token and could not
write the check-run, status, or label. `pull_request_target` runs with a
base-context write token, which is safe only because the workflow never checks
out or runs PR code. The job is named `pr-policy (evaluate)` so it does not
collide with the `pr-policy` check-run and status.

## Related

- [merge-safety](merge-safety.md) — the other consumed PR-evaluation CLI.
- [Repo hygiene](repo-hygiene.md) — the shared file-content gates.
