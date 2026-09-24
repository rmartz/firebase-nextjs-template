---
type: Subsystem
title: pr-policy
description: The shared @rmartz/pr-policy PR content checks, run via rmartz/pr-policy-action on pull_request_target — adopted here as the pilot for replacing the per-repo pr-title-lint.yml.
resource: .github/workflows/pr-policy.yml
tags: [ci, github-actions, pr-policy, poc]
---

# pr-policy

[`.github/workflows/pr-policy.yml`](../../.github/workflows/pr-policy.yml) runs
[`rmartz/pr-policy-action`](https://github.com/rmartz/pr-policy-action), which
wraps the [`@rmartz/pr-policy`](https://github.com/rmartz/pr-policy) CLI. The CLI
reads the PR's title, labels, and changed files through the API, then posts a
single blocking **`pr-policy`** check-run and reconciles the labels it owns. This
repo **consumes** the action; it does not re-implement any policy.

## What it checks today

The pinned action (v1.0.0) bundles pr-policy 0.1.0, which ships only the
**CI-change** check: a PR that loosens CI (removes a step or job, adds
`continue-on-error`, narrows a trigger, extends a timeout, …) gets the
`CI approval needed` label and a failing check until a human applies
`CI change approved`.

The **title-type** check (Conventional Commit types, `!` only on functional types,
`ci` typing for workflow changes) is not released yet, so
[`pr-title-lint.yml`](../../.github/workflows/pr-title-lint.yml) still gates PR
titles.

## Why it is here — a pilot for rmartz/ai-tools#312

That issue retires the `pr-title-lint.yml` copy in every repo in favour of
pr-policy's title check. This repo adopts the caller first to prove the
mechanics end to end: installing the CLI from GitHub Packages, the
`pull_request_target` token posting the check-run and labels on Dependabot and
fork PRs, and re-evaluation on `edited` / `labeled` / `unlabeled`.

`pr-policy` is **not yet a required status**. Once the title check ships and has
run cleanly here, the switch-over is: require `pr-policy` in the default-branch
ruleset, then delete `pr-title-lint.yml` in a `ci`-typed PR.

## Why `pull_request_target`

Under `pull_request`, fork and Dependabot PRs get a read-only token and could not
write the check-run or label. `pull_request_target` runs with a base-context
write token, which is safe only because the workflow never checks out or runs PR
code. The job is named `pr-policy (evaluate)` so it does not collide with the
CLI's own `pr-policy` check-run.

## Related

- [merge-safety](merge-safety.md) — the other consumed PR-evaluation CLI.
- [Repo hygiene](repo-hygiene.md) — the shared file-content gates.
