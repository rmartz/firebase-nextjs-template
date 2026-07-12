---
type: Script
title: validate-anchor-uniqueness.mjs
description: Reports per-file "edit fragility" — the fraction of significant lines that are not a unique exact-string anchor.
resource: scripts/validate-anchor-uniqueness.mjs
tags: [ci, agent-legibility, edit-fragility, metrics, report-only]
---

# validate-anchor-uniqueness.mjs

POC for the [Agent-legible codebase guards epic](https://github.com/rmartz/firebase-nextjs-template/issues/161) (edit-fragility guard, [#162](https://github.com/rmartz/firebase-nextjs-template/issues/162)).

Agents edit code by **exact-string match**, so an edit needs a **unique anchor**. A file full of identical lines forces edits to fail-to-anchor or drag a large disambiguating window into context. This script measures that, per file, as an **edit-fragility** score:

```
fragility = (# significant lines whose exact form appears >= 2x) / (# significant lines)
```

`0.0` = every line is a unique standalone anchor; higher = more lines need surrounding context to target.

## Usage

```bash
pnpm run fragility:report          # human table, worst files first (exits 0)
node scripts/validate-anchor-uniqueness.mjs --json   # machine output
node scripts/validate-anchor-uniqueness.mjs --max 0.30   # gate: exit 1 over 30%
```

**Report-only by default** — it is a measurement, run in CI as the `Codebase health (report-only)` job, to calibrate a threshold from the real distribution before it becomes a gate. `--max <ratio>` turns it into a gate.

## What counts

- Scans `.ts/.tsx/.mjs/.cjs/.js/.jsx` under `src/` and `scripts/`; skips vendored `src/components/ui/**`.
- A line is **significant** if, trimmed, it is non-empty and not purely structural punctuation or a bare comment marker (`}`, `});`, `],`, `/>`, `*`, `*/`, `/**`, `//`) — those repeat unavoidably and are never real anchors.
- Significant lines are keyed **with leading indentation** but without trailing whitespace, matching exactly what an exact-string edit targets: two identical lines at the same indent collide; the same content at different indents does not. (Indent-shifted **block** clones are the complementary `jscpd` metric, also tracked in #162.)

## Reading the output

Each flagged file lists its top repeated lines (`x4  args: {`) so the fragility is actionable, and the run ends with a `p50 / p90 / max` distribution. Story and spec files score higher by nature (repeated fixtures / assertions) — like the file-length cap's higher test threshold, a future gate will likely allow them a higher fragility ceiling than source files.

## Requires

- `node` (reads source files only — no dependency install needed)

## Related

- [validate-pins.mjs](validate-pins.md), [validate-action-pins.mjs](validate-action-pins.md) — sibling standalone validators (these gate; this one reports).
