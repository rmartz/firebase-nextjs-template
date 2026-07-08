---
type: Script
title: validate-action-pins.mjs
description: Fails CI if any third-party GitHub Action is not pinned to a full commit SHA with a version comment.
resource: scripts/validate-action-pins.mjs
tags: [ci, github-actions, security, supply-chain, validation]
---

# validate-action-pins.mjs

Enforces the SHA-pinning rule from `AGENTS.md`: every third-party action referenced in `.github/workflows/*.yml` and `.github/actions/*/action.yml` must pin the full 40-char commit SHA with the version in a trailing comment — e.g. `uses: actions/checkout@9c091bb… # v7.0.0`, never `@v7`.

A mutable tag can be silently repointed at attacker-controlled code (compromised maintainer, hijacked repo), which CI would then fetch and run with the workflow token and repository contents in scope. A commit SHA is immutable, so the pin can't be swapped underneath us. This check is the ratchet that keeps an unpinned `uses:` from being reintroduced — the supply-chain analogue of [validate-pins.mjs](validate-pins.md) for `package.json`.

## Usage

```bash
node scripts/validate-action-pins.mjs
pnpm run actions:validate
```

It runs in CI as the **Action pins** job in `.github/workflows/ci-actions.yml`, gated by the `detect-changes` job to run only when a workflow / composite-action file (or this validator) changes — a closed-input check needs no run otherwise.

## What it checks

For every `uses:` line under `.github/workflows/` and `.github/actions/`:

- **Remote actions** (`owner/repo[/path]@ref`, including reusable workflows) must have `ref` matching `^[0-9a-f]{40}$` **and** carry a trailing comment with a full `[major].[minor].[patch]` version (`# v7.0.0` — the `v` is optional, a prerelease/build suffix is allowed). A bare, non-version, or **partial** comment (`# pinned`, `# v7`, `# v7.0`) is rejected: Dependabot reads this version to keep the SHA updated, and a precise version is the unambiguous anchor — a partial one lands in the flaky SHA-pin comment-parsing path and can leave within-major updates unproposed. Mirrors the full-version pin rule for `package.json`.
- **Local composite refs** (`./…`, `../…`) are in-repo — no external tag to repoint — and are skipped.

Exits 0 when every remote action is SHA-pinned; exits 1 with a `file:line  ref  — reason` line per offender.

## Requires

- `node` (reads workflow / action YAML only — no dependency install needed)

## Related

- [validate-pins.mjs](validate-pins.md) — the `package.json` full-version pin analogue.
- [validate-config.mjs](validate-config.md), [validate-docs.mjs](validate-docs.md) — sibling standalone validators.
