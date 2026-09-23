---
type: Subsystem
title: storybook-ci
description: The shared rmartz/storybook-ci reusable workflows that provide this repo's gating Storybook tests plus its advisory per-PR screenshot gallery, and what adopting them replaced.
resource: .github/workflows/storybook-tests.yml
tags: [ci, github-actions, storybook, screenshots, poc]
---

# storybook-ci

Storybook CI here is **consumed, not implemented**. Two thin caller workflows
delegate to [`rmartz/storybook-ci`](https://github.com/rmartz/storybook-ci)'s
reusable workflows, pinned by SHA with a `# vX.Y.Z` comment that Dependabot's
`github-actions` ecosystem keeps current:

| Caller                                                                           | Delegates to                | Posture                                             |
| -------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------- |
| [`storybook-tests.yml`](../../.github/workflows/storybook-tests.yml)             | `storybook-tests.yml`       | **Gating** — required check                         |
| [`storybook-screenshots.yml`](../../.github/workflows/storybook-screenshots.yml) | `storybook-screenshots.yml` | **Advisory** — never blocks, never a required check |

This repo is the fleet's **proof-of-concept consumer** (issue #253).

## What the tests caller runs

Two jobs inside the shared workflow, both gated by its own `detect-changes`
docs-only denylist:

- **Storybook Tests** — the story suite as Vitest browser-mode tests in real
  Chromium. This repo overrides `test-command` to `pnpm test:storybook`, because
  it runs the suite through a dedicated `vitest.storybook.config.ts` rather than a
  `storybook` project inside `vitest.config.mts` (the shared default of
  `pnpm exec vitest run --project storybook` would not resolve).
- **Storybook Build** — `pnpm build-storybook`. A distinct render surface from
  both the Next.js `Build` job (different entrypoint and bundler) and the story
  suite (which renders through the addon-vitest transform and never invokes
  `storybook build`), so neither covers it.

## What the screenshots caller runs

One advisory job that builds Storybook, screenshots the stories a PR's changes
touch (the `colocation` resolver, by default), and posts them as **one
update-in-place PR comment** whose images are GitHub user-attachments uploaded via
`gh --attach`. There is no artifact to download, no orphan image branch, and no
cleanup workflow.

It requires **`STORYBOOK_SCREENSHOT_PAT`**, forwarded by `secrets: inherit`,
because the user-attachments upload endpoint rejects the Actions `GITHUB_TOKEN`
(an installation token). Since v1.1.0 a **preflight** step runs before the
expensive Storybook build: a missing or invalid PAT posts one non-blocking
advisory PR comment and skips the build and capture, so a misconfigured PAT
announces itself rather than resembling a clean run. The whole job is skipped on
fork PRs so the PAT never reaches fork-authored code.

Upstream documents the secret as a **classic** PAT with `repo` scope, on the basis
that fine-grained PATs were never confirmed against the upload endpoint. As the POC
consumer we are testing that assumption directly rather than inheriting it — see
[rmartz/storybook-ci#12](https://github.com/rmartz/storybook-ci/issues/12).

## Required-check shape

A reusable workflow's check context is `<caller job> / <called job>`, so the
default-branch ruleset requires **`storybook-tests / Storybook Tests`**, not the
bare `Storybook Tests` the pre-adoption job produced.

The tests caller therefore must **not** carry an `on.paths` filter: gating is a
`detect-changes` job plus per-job `if:` inside the shared workflow. A skipped
required job counts as passing; a required check that never runs because its paths
did not match hangs the PR forever. The screenshots caller is advisory and never
required, so it may safely use `on.paths`.

## What adoption replaced

Before #253 this repo hand-rolled the whole thing:

- `storybook-tests`, `storybook-build`, and `storybook-screenshots` jobs inside
  `ci-actions.yml`;
- `.github/actions/playwright-chromium/` — a composite action for Chromium cache,
  install, and retry;
- `scripts/capture-screenshots.mjs` — capture, surfaced only as a downloadable
  workflow artifact (the friction #131 set out to remove);
- the `stories_changed` output of `ci-actions.yml`'s `detect-changes` job, whose
  only consumer was the screenshots job.

All of it is now centralized once in the shared repo, so the subtle operational
reasoning — Chromium provisioning, change gating, fail-vs-cancel deadlines, per-PR
concurrency, fork exclusion, advisory isolation — cannot drift per consumer.
