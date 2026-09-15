---
type: Subsystem
title: Edit-fragility evaluation
description: The evaluation harness that validates the edit-fragility metric against real agent edits, and the keep-or-kill finding it produced.
resource: scripts/eval-edit-fragility.mjs
tags: [agent-legibility, edit-fragility, metrics, evaluation, ci]
---

# Edit-fragility evaluation

The edit-fragility (anchor-uniqueness) metric ships as a report-only CI job
([`validate-anchor-uniqueness.mjs`](../scripts/validate-anchor-uniqueness.md)),
computing a per-file `fragility` score on every PR. This subsystem is the
**validation half** ([#237](https://github.com/rmartz/firebase-nextjs-template/issues/237))
of that POC ([#162](https://github.com/rmartz/firebase-nextjs-template/issues/162),
epic [#161](https://github.com/rmartz/firebase-nextjs-template/issues/161)): the
tooling and the evidence that answer whether the score means anything before it
is ever allowed to become a gate.

## The pipeline

| Stage           | Tool                                                                                  | Output                                                                                   |
| --------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Score           | [`validate-anchor-uniqueness.mjs`](../scripts/validate-anchor-uniqueness.md) `--json` | per-file `fragility`                                                                     |
| Ground truth    | [`mine-edit-outcomes.mjs`](../scripts/mine-edit-outcomes.md) `--json`                 | per-file failures / retries / disambiguation-window sizes, mined from Claude transcripts |
| Join + analysis | [`eval-edit-fragility.mjs`](../scripts/eval-edit-fragility.md)                        | Spearman correlation, false-positive-class split                                         |
| Persistence     | `eval-edit-fragility.mjs --snapshot` → `metrics/edit-fragility-history.jsonl`         | durable, append-only score distribution over time                                        |

## The question

Does a higher fragility score predict more failed / multi-attempt exact-string
edits on that file? The metric's premise is that agents edit by exact-string
match, so a file full of non-unique lines forces edits either to fail to anchor
or to drag a large disambiguating window into context.

## The finding (first run)

Run against this machine's local transcript corpus (**293 edits across 68 files**;
`scored ∩ edited` = **13 files**):

- **Spearman rho ≈ 0.42** between fragility and the median disambiguation-window
  size — a **moderate positive** relationship, identical for all-files and
  source-only (no test/story/fixture files fell in the join, so the
  false-positive classes did not distort this run).
- **Zero anchor failures on any scored file.** All 13 anchor failures in the
  corpus landed on files the metric does **not** score — `AGENTS.md`,
  `ci-actions.yml`, `README.md`, docs — because agent editing in this repo
  concentrates on prose/config/workflows, not the `src/` + `scripts/` code the
  metric scans. The metric's **core claim** (predicting failed anchoring) is
  therefore **unvalidated**: there is no positive class to correlate against.

## Recommendation: keep report-only, do not gate yet

The window-size signal is encouraging but weak — `rho ≈ 0.42` at `n = 13` is
suggestive, not decisive, and the disambiguation window is a _proxy_ for edit
difficulty, not the failure the metric claims to predict. With zero anchor
failures on scored files, a threshold gate would be calibrated against no
evidence of the harm it is meant to prevent.

So: **keep the metric report-only and keep accumulating** the now-persisted
distribution (`metrics/edit-fragility-history.jsonl`); do **not** promote it to a
gate. **Tripwire to kill:** if, after the ledger has grown across many more
merges, source-file anchor failures remain at ~zero and the window-size
correlation does not strengthen, the metric predicts nothing actionable in this
repo and should be retired — a perfectly good outcome for an experiment, and far
cheaper to learn now than after it is a gate.

## False-positive classes

Tests, stories, and fixtures are fragile-by-score (repeated `expect` assertions,
JSX, `make*` fixtures) yet trivially editable, so
[`eval-edit-fragility.mjs`](../scripts/eval-edit-fragility.md) labels every row
`test` / `story` / `fixture` / `source` and reports window-size correlation both
across all files and across source only. Any future threshold must exempt or
raise the ceiling for the non-source classes — exactly as the file-length cap
already grants tests a higher limit than source.

## Reproducing

```bash
pnpm run fragility:eval        # join + correlation against local transcripts
pnpm run fragility:snapshot    # append the current score distribution to the ledger
```

The correlation depends on the transcript corpus on the machine that runs it, so
the numbers above are a snapshot, not a fixed result; re-running as the ledger
grows is the intended way to revisit the recommendation.
