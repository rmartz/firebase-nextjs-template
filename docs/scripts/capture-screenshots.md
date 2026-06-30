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

## CI

The **Storybook Screenshots** job in `.github/workflows/ci-actions.yml` runs this on PRs, but only when a `*.stories.tsx` file changed (gated by the `detect-changes` job). The job is **advisory** (`continue-on-error`) and uploads `screenshots/` as a workflow artifact — download it from the run's Artifacts section to review. There is no shared resource (the artifact is per-run), so concurrent PR runs never race; no concurrency group is needed.

## Output

- `screenshots/<story-id>.png` — one per story (e.g. `auth-signinform--with-error.png`).
- Exits non-zero if `storybook-static/` is missing or any story fails to render; the CI job is advisory, so a non-zero exit never blocks the PR.

## Requires

- `node`, `playwright` (Chromium), a built `storybook-static/`

## Related

- [validate-docs.mjs](validate-docs.md) — sibling standalone script.
