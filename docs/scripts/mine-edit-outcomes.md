---
type: Script
title: mine-edit-outcomes.mjs
description: Mines Claude Code transcripts for per-file Edit outcomes — anchor failures, retries, and disambiguation-window sizes — the ground truth for the edit-fragility evaluation.
resource: scripts/mine-edit-outcomes.mjs
tags: [ci, agent-legibility, edit-fragility, metrics, evaluation]
---

# mine-edit-outcomes.mjs

The [edit-fragility score](validate-anchor-uniqueness.md) _claims_ to predict when
an agent will struggle to land an exact-string `Edit`. This script mines the
**ground truth** for that claim from Claude Code session transcripts, so the
score can be validated rather than trusted on intuition ([#237](https://github.com/rmartz/firebase-nextjs-template/issues/237), epic [#161](https://github.com/rmartz/firebase-nextjs-template/issues/161)).

For every file that was edited it reports the three difficulty signals #237 named:

- **failures** — `Edit` results that failed to anchor: `String to replace not found` (not-found) or `Found N matches` / not-unique.
- **retries** — a fail-then-reattempt on the **same file** within one session.
- **window** — the size of the disambiguating context each `Edit` had to carry (the `old_string` length), reported as the per-file median and max. This is the continuous "hard to target" proxy that exists **even for edits that succeeded**.

## Usage

```bash
pnpm run fragility:mine                              # human table, most-edited first
node scripts/mine-edit-outcomes.mjs --json           # machine output
node scripts/mine-edit-outcomes.mjs --transcripts <dir>   # override the transcript source
```

## Where the data comes from

Claude Code writes one JSONL transcript per session under
`~/.claude/projects/<encoded-cwd>/*.jsonl`. By default the script reads every
project directory whose name contains `firebase-nextjs-template` (the repo's own
sessions **and** its worktree sandboxes), pairs each `Edit` `tool_use` with its
`tool_result`, and normalizes the edited path back to repo-relative (stripping
any `.git-worktrees/<branch>/` prefix) so it joins against the score.

Because transcripts live on the developer's machine, this is a **local analysis
tool**, not a CI gate — its output feeds [`eval-edit-fragility.mjs`](eval-edit-fragility.md).

## Caveats

- The corpus is only as representative as the sessions on the machine that runs it. A repo whose agent activity is mostly docs/config edits will show little source-file ground truth.
- "Retry" is deliberately narrow (a failure immediately followed by another edit to the same file in the same session), so ordinary multi-edit work is **not** counted as a retry.
