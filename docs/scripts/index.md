# Scripts

Reference pages for the executables under `scripts/`. See
[the OKF format](../okf-format.md) for how these pages are structured.

- [capture-screenshots.mjs](capture-screenshots.md) — screenshot every Storybook story in Chromium for visual acceptance review.
- [check-agents-md.mjs](check-agents-md.md) — enforce that every AGENTS.md is paired with a bare `@AGENTS.md` CLAUDE.md wrapper.
- [update-config.sh](update-config.md) — update public deployment config, validate it, and optionally sync to Vercel.
- [validate-action-pins.mjs](validate-action-pins.md) — enforce commit-SHA pins on GitHub Actions.
- [validate-anchor-uniqueness.mjs](validate-anchor-uniqueness.md) — report per-file edit fragility (anchor uniqueness); POC for the agent-legibility epic.
- [validate-config.mjs](validate-config.md) — validate deployment config files against the schema.
- [validate-docs.mjs](validate-docs.md) — validate the OKF frontmatter on these docs pages.
- [validate-docs-index.mjs](validate-docs-index.md) — enforce that the docs tree is navigable through its `index.md` files.
- [validate-pins.mjs](validate-pins.md) — enforce full-version pins in package.json.
- [vercel-ignore-build.sh](vercel-ignore-build.md) — skip Vercel preview deploys for non-feat/fix PRs to conserve quota.
