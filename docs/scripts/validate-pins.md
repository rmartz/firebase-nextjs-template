---
type: Script
title: validate-pins.mjs
description: Fails CI if any package.json dependency pin is not a full [major].[minor].[patch] version.
resource: scripts/validate-pins.mjs
tags: [dependencies, dependabot, ci, validation]
---

# validate-pins.mjs

Enforces the full-version pin rule from `AGENTS.md`: every registry dependency in `package.json` must specify a full `[major].[minor].[patch]` base, even with a `^` / `~` operator (e.g. `^3.8.4`, never `^3` or `^3.8`).

A bare-major range lets Dependabot satisfy a bump via the `pnpm-lock.yaml` alone with **no `package.json` diff**, so the update is invisible in review — the failure mode where a Prettier minor bump reformats the codebase and surfaces only as a red `Format` check. This check is the ratchet that keeps a non-compliant pin from being reintroduced.

## Usage

```bash
node scripts/validate-pins.mjs
pnpm run pins:validate
```

It runs in CI as the **Pin format** job in `.github/workflows/ci-actions.yml`, gated by the `detect-changes` job to run only when `package.json` (or this validator) changes — a closed-input check needs no run otherwise.

## What it checks

For each entry in `dependencies`, `devDependencies`, `optionalDependencies`, and `peerDependencies`:

- Strips a leading `^` / `~` and asserts the remainder matches `\d+\.\d+\.\d+` (a prerelease/build suffix is allowed).
- Skips non-registry specifiers that carry no semver range: `github:`, `git+`/`git:`, `http(s):`, `file:`, `link:`, `portal:`, `workspace:`, `catalog:`, and `npm:` aliases.

Exits 0 when every pin is full; exits 1 with a `section / dependency / "range"` line per offender.

## Requires

- `node` (reads `package.json` only — no dependency install needed)

## Related

- [validate-config.mjs](validate-config.md), [validate-docs.mjs](validate-docs.md) — sibling standalone validators.
