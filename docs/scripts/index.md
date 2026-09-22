# Scripts

Reference pages for the executables under `scripts/`. See
[the OKF format](../okf-format.md) for how these pages are structured.

- [dependabot-audit.mjs](dependabot-audit.md) — classify every Dependabot PR's outcome and report per-group intervention rates.
- [eval-edit-fragility.mjs](eval-edit-fragility.md) — join the edit-fragility score against mined ground truth, report correlation, and persist score snapshots.
- [mine-edit-outcomes.mjs](mine-edit-outcomes.md) — mine agent transcripts for per-file Edit outcomes (anchor failures, retries, disambiguation-window sizes).
- [update-config.sh](update-config.md) — update public deployment config, validate it, and optionally sync to Vercel.
- [validate-anchor-uniqueness.mjs](validate-anchor-uniqueness.md) — report per-file edit fragility (anchor uniqueness); POC for the agent-legibility epic.
- [validate-config.mjs](validate-config.md) — validate deployment config files against the schema.
- [validate-pins.mjs](validate-pins.md) — enforce full-version pins in package.json.
- [vercel-ignore-build.sh](vercel-ignore-build.md) — skip Vercel preview deploys for non-feat/fix PRs to conserve quota.
