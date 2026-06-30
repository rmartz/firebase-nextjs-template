---
type: Script
title: vercel-ignore-build.sh
description: Vercel Ignored Build Step that skips preview deploys for non-feat/fix PRs to conserve the daily quota.
resource: scripts/vercel-ignore-build.sh
tags: [vercel, deployment, ci, preview]
---

# vercel-ignore-build.sh

Vercel's [Ignored Build Step](https://vercel.com/docs/projects/overview#ignored-build-step) hook. It decides whether a deploy proceeds so the daily preview-deploy quota isn't spent on PRs that don't need a live preview.

**Policy:** production always builds; a PR preview builds only when the PR title is a `feat:` or `fix:` (optional `(scope)` / `!` allowed). Every other type — `chore`, `docs`, `ci`, `test`, `refactor`, `style`, … — skips the preview.

## Exit codes (Vercel convention)

- **exit 1 → build** (proceed with the deploy)
- **exit 0 → skip** (cancel the deploy)

## How it reads the PR title

It resolves the PR title from the **public** GitHub API using Vercel's system env vars (`VERCEL_GIT_PULL_REQUEST_ID`, `VERCEL_GIT_REPO_OWNER`, `VERCEL_GIT_REPO_SLUG`) — no token needed, since this repo is public. `node` parses the JSON (no `jq` dependency). Vercel injects `VERCEL_ENV` and the `VERCEL_GIT_*` vars into the ignore command automatically (the same vars `turbo-ignore` / `nx-ignore` rely on), so there is no env-var or secret setup.

It **fails open**: if the title can't be read (rate limit, network, or no PR context — e.g. a branch push with no open PR) it builds. The gate only ever _skips_ when it has positively confirmed a non-`feat`/`fix` title, so a preview UAT needs is never wrongly cancelled.

## Wiring

Wired via `vercel.json`:

```json
{ "ignoreCommand": "bash scripts/vercel-ignore-build.sh" }
```

`ignoreCommand` is a first-class `vercel.json` field that **overrides** the Project Settings "Ignored Build Step" ([docs](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand)) — same precedence as `buildCommand` / `installCommand`. So the gate is version-controlled, travels with every fork/clone of this template, and is **active on merge with no dashboard step**. The only thing to confirm post-merge is the first preview build log's **"Running ignore command"** step, which prints the build/skip decision.

## Requires

- `curl`, `node` (both present in Vercel's build image)

## Related

- A follow-up will move this to a label-based gate (deploy only when a PR is `ready for UAT`), which needs a Vercel API key — see the linked issue.
