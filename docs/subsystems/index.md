# Subsystems

Reference pages for cohesive areas of the codebase. See
[the OKF format](../okf-format.md) for how these pages are structured.

- [Deployment config](deployment-config.md) — how public env config is stored, validated, and synced, and how secrets are kept out and rotated.
- [merge-safety](merge-safety.md) — the advisory "must this PR be brought current before merge?" check, consuming ai-tools' published `@rmartz/pr-review` CLI.
