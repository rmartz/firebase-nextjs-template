---
type: Script
title: eval-edit-fragility.mjs
description: Joins the edit-fragility score against mined edit-outcome ground truth, reports Spearman correlation with false-positive-class treatment, and persists score snapshots to a durable ledger.
resource: scripts/eval-edit-fragility.mjs
tags: [ci, agent-legibility, edit-fragility, metrics, evaluation]
---

# eval-edit-fragility.mjs

The validation half of the edit-fragility POC ([#237](https://github.com/rmartz/firebase-nextjs-template/issues/237),
epic [#161](https://github.com/rmartz/firebase-nextjs-template/issues/161) / [#162](https://github.com/rmartz/firebase-nextjs-template/issues/162)).
It joins the per-file [fragility score](validate-anchor-uniqueness.md) against the
ground truth from [`mine-edit-outcomes.mjs`](mine-edit-outcomes.md) and answers the
question the score could never answer on its own: **does a higher fragility score
actually predict harder-to-anchor edits?**

## What it computes

- **Correlation** — Spearman's rho (rank-based, robust to the score's skew and to small _n_) between fragility and each difficulty signal: the disambiguation-window size, and the anchor-failure count.
- **False-positive classes (AC5)** — every joined row is labelled `test` / `story` / `fixture` / `source`, and window-size correlation is reported both across **all** files and across **source only**. Tests, stories, and fixtures are fragile-by-score (repeated `expect` / JSX / fixtures) yet trivially editable — the metric's most obvious failure mode — so separating them is essential to reading the result honestly.

## Usage

```bash
pnpm run fragility:eval          # run the full analysis against local transcripts
pnpm run fragility:snapshot      # append a score snapshot to the durable ledger
node scripts/eval-edit-fragility.mjs --transcripts <dir>   # override transcript source
```

`fragility:eval` shells the score and miner CLIs (`--json`) so the two scripts
remain the single source of truth for their halves of the join.

## Persistence — the durable ledger (AC3)

`--snapshot <ledger>` appends one JSON line — `{ date, commit, files: [{ path,
fragility, significant }] }` — to `metrics/edit-fragility-history.jsonl`. That
committed, append-only ledger accumulates the score distribution over time
instead of evaporating with each report-only CI run, which is what a calibrated
threshold would eventually be drawn from. The ledger is exempt from the
[file-size cap](../../.repo-hygiene.yml) because it grows by design.

## Reading the result

See [the edit-fragility evaluation subsystem](../subsystems/edit-fragility-evaluation.md)
for the current finding and the keep-or-kill recommendation drawn from it.
