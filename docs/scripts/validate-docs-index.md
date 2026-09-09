---
type: Script
title: validate-docs-index.mjs
description: Fails CI unless every docs/ page is reachable by following index.md links down from docs/index.md.
resource: scripts/validate-docs-index.mjs
tags: [docs, okf, validation, ci]
---

# validate-docs-index.mjs

Enforces that the `docs/` tree is fully navigable through its OKF `index.md`
files, so a reader (or an agent) can reach any page by following links from
`docs/index.md` down. A page that exists but is linked from nowhere is invisible
to anyone browsing the docs — this check makes that a CI failure. See
[the OKF format](../okf-format.md) for the index convention it enforces.

## Usage

```bash
node scripts/validate-docs-index.mjs
pnpm run docs:index
```

It runs in CI as part of the **Docs (OKF)** job in `.github/workflows/ci-actions.yml`, alongside [validate-docs.mjs](validate-docs.md).

## What it checks

A directory is "documented" when it directly contains at least one `.md` file. For every documented directory:

1. **Has an index** — the directory contains an `index.md`.
2. **Lists its pages** — every content page in it (every `.md` other than `index.md`) is linked from that directory's `index.md`.
3. **Links its children** — every documented sub-directory's `index.md` is linked from its parent documented directory's `index.md`.

Rules 1 and 3 make every index reachable from `docs/index.md` by induction, and rule 2 lists every page under some reachable index — e.g. `docs/index.md` → `scripts/index.md` → `scripts/validate-docs.md`.

Only local `.md` link targets are considered; external, anchor-only, and non-markdown links are ignored. Exits 0 when the tree is navigable, 1 with a per-violation report otherwise.

## Requires

- `node` (reads the docs tree only — no dependency install needed)

## Related

- [The OKF documentation format](../okf-format.md) — the index convention this enforces.
- [validate-docs.mjs](validate-docs.md) — the companion frontmatter check.
