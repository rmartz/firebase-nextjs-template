---
type: Subsystem
title: pr-policy
description: The shared @rmartz/pr-policy PR content checks, run by the hosted rmartz-pr-lifecycle-gate GitHub App (no workflow in this repo), which posts the required pr-policy check; this repo keeps the UAT gate as a Next.js app and relies on pr-policy's title check in place of the retired pr-title-lint.yml.
tags: [ci, github-app, pr-policy, uat]
---

# pr-policy

This repo has **no pr-policy workflow**. The
[`@rmartz/pr-policy`](https://github.com/rmartz/pr-policy) checks run in the
hosted `rmartz-pr-lifecycle-gate` GitHub App, the gate role of
[`rmartz/pr-lifecycle-app`](https://github.com/rmartz/pr-lifecycle-app). The App
receives this repo's PR webhooks, reads the PR's title, labels and changed files
through the API, then posts the blocking **`pr-policy`** verdict and reconciles
the labels it owns. Its settings for this repo live in the App's
[`src/repos.ts`](https://github.com/rmartz/pr-lifecycle-app/blob/main/src/repos.ts),
so changing them is a PR there, not here. A PR can't change them.

**The required check belongs to the gate App.** The branch ruleset requires
`pr-policy` from the gate App (integration 5460238), not from GitHub Actions.
Only the App's key can satisfy it, so a workflow with `statuses: write` can't
post a green `pr-policy`.

## What it checks

The checks, and what makes each one red or pending, are listed in
[pr-policy's check docs](https://github.com/rmartz/pr-policy/blob/main/docs/checks/index.md).
The version in force is the one the App deploys. In short: red means the author
has something to fix (a bad title, for example), and pending means a person has
to act. A PR's checks list has a **Re-run** button for the `pr-policy` check.

**This repo keeps the UAT gate**, because it is a Next.js app with something to
user-test. A PR stays pending until it carries `no UAT needed` (the review
agent's call) or a person's `UAT passed`. The App runs with:

- **The UAT label required.** pr-policy holds a PR that carries no UAT label, so
  every merge has an explicit UAT determination. [pr-lifecycle](pr-lifecycle.md)
  keeps one on every open PR.
- **The Dependabot `ci` retitle.** A Dependabot linter or formatter bump is
  retitled to `ci(...)`, the type the title check requires for it.
- **pr-lifecycle's sign-off status trusted.** pr-policy gates UAT and CI sign-off
  on the `pr-lifecycle/sign-off` commit status that `rmartz-pr-lifecycle[bot]`
  posts, and re-evaluates when it changes.

The verdict is posted twice: as the `pr-policy` check-run and as a `pr-policy`
commit status. The App also posts one informational status per check
(`pr-policy / title`, `pr-policy / uat`, …).

## PR titles — pr-title-lint retired

This repo was the fleet pilot for pr-policy. The switch-over is done: the
per-repo `pr-title-lint.yml` is retired, and PR titles are checked by
pr-policy's `title` check, part of the required `pr-policy` check
(rmartz/ai-tools#312).

## Related

- [pr-lifecycle](pr-lifecycle.md) — the reconciler whose sign-off status this gate reads.
- [merge-safety](merge-safety.md) — the other PR-evaluation check.
- [Repo hygiene](repo-hygiene.md) — the shared file-content gates.
