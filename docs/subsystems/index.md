# Subsystems

Reference pages for cohesive areas of the codebase. See
[the OKF format](../okf-format.md) for how these pages are structured.

- [Deployment config](deployment-config.md) — how public env config is stored, validated, and synced, and how secrets are kept out and rotated.
- [Edit-fragility evaluation](edit-fragility-evaluation.md) — the harness that validates the edit-fragility metric against real agent edits, and the keep-or-kill finding it produced.
- [merge-safety](merge-safety.md) — the advisory "must this PR be brought current before merge?" check, consuming ai-tools' published `@rmartz/pr-review` CLI.
- [pr-policy](pr-policy.md) — the shared `@rmartz/pr-policy` PR content checks (CI-change today, title-type next), piloted here ahead of retiring `pr-title-lint.yml`.
- [Repo hygiene](repo-hygiene.md) — the shared `@rmartz/repo-hygiene` quality gates (conflict markers, action pins, AGENTS/CLAUDE pairing, OKF frontmatter, file caps) and how they are wired.
- [storybook-ci](storybook-ci.md) — the shared `rmartz/storybook-ci` reusable workflows behind this repo's gating Storybook tests and advisory per-PR screenshot gallery.
