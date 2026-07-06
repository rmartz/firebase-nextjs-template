---
type: Script
title: capture-screenshots.mjs
description: Captures a PNG screenshot of every Storybook story in real Chromium for visual acceptance review.
resource: scripts/capture-screenshots.mjs
tags: [storybook, screenshots, playwright, ci, visual]
---

# capture-screenshots.mjs

Renders the pre-built static Storybook in real Chromium (via Playwright) and writes a screenshot of every story to `screenshots/<story-id>.png`. Used as a **visual acceptance aid** — a reviewer eyeballs the rendered result of an intended UI change — not a regression gate (the always-on `Storybook Tests` job is the regression gate).

## Usage

```bash
pnpm build-storybook        # produce storybook-static/ first
pnpm screenshots            # capture screenshots into screenshots/
```

The script serves `storybook-static/` over a local HTTP server (static Storybook needs HTTP, not `file://`), visits each story's `iframe.html`, and screenshots `#storybook-root`. It does **not** build Storybook — build first.

Stories are captured **concurrently** (a pool of 4 pages) with a short per-story render budget (`domcontentloaded` navigation + a visibility wait), and the whole run is bounded by a **wall-clock deadline** (default 4 min, override with `CAPTURE_DEADLINE_MS`). On the deadline the script exits non-zero immediately rather than running on.

## CI

The **Storybook Screenshots** job in `.github/workflows/ci-actions.yml` runs this on PRs, but only when a `*.stories.tsx` file changed (gated by the `detect-changes` job). The job is **advisory** — its `continue-on-error` is at the **job level**, so a failure is non-blocking for the run — but the capture step itself has **no** `continue-on-error`, so a capture failure surfaces as a job **`failure`**. That matters: a job that runs to `timeout-minutes` is **cancelled**, which the PR coordinator escalates to a human; a fast non-zero exit is a **`failure`**, which is auto-routed to fix-review where an agent can fix a broken or slow story. The in-script deadline (below the job's `timeout-minutes`) is what keeps failures fast instead of turning into cancellations.

It uploads `screenshots/` as a workflow artifact — download it from the run's Artifacts section to review. There is no shared resource (the artifact is per-run), so concurrent PR runs never race; no concurrency group is needed.

## Output

- `screenshots/<story-id>.png` — one per story (e.g. `auth-signinform--with-error.png`).
- Exits `0` when every story was captured; exits non-zero if `storybook-static/` is missing, any story fails to render, or the deadline was hit before all stories were attempted. The job-level `continue-on-error` keeps a non-zero exit non-blocking for the PR.

## Requires

- `node`, `playwright` (Chromium), a built `storybook-static/`

## Related

- [validate-docs.mjs](validate-docs.md) — sibling standalone script.
