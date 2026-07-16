---
type: Index
title: Documentation index
description: Index of reference pages for this repo's scripts and subsystems, structured to Google's Open Knowledge Format (OKF).
tags: [docs, okf, index]
---

# Documentation

Reference pages an agent (or human) can retrieve before working on a task. Each page documents one script or subsystem and follows [Google's Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md): a markdown file with YAML frontmatter, cross-linked to related pages via plain markdown links.

This `README.md` serves as the OKF index for the directory.

## Frontmatter

Every page carries frontmatter. Only `type` is required; the rest are recommended:

```yaml
---
type: Script # or Subsystem
title: update-config.sh
description: One-line summary of what the page documents.
resource: scripts/update-config.sh # repo-relative path to what it documents
tags: [deployment, config]
---
```

### `type` vocabulary

- **Script** — a standalone executable under `scripts/`.
- **Subsystem** — a cohesive area of the codebase (a directory, a flow, a layer) rather than a single file.
- **Index** — this directory listing (the OKF `index` convention).

## Pages

### Scripts

- [capture-screenshots.mjs](scripts/capture-screenshots.md) — screenshot every Storybook story in Chromium for visual acceptance review.
- [update-config.sh](scripts/update-config.md) — update public deployment config, validate it, and optionally sync to Vercel.
- [validate-config.mjs](scripts/validate-config.md) — validate deployment config files against the schema.
- [vercel-ignore-build.sh](scripts/vercel-ignore-build.md) — skip Vercel preview deploys for non-feat/fix PRs to conserve quota.
- [validate-docs.mjs](scripts/validate-docs.md) — validate the OKF frontmatter on these docs pages.
- [validate-pins.mjs](scripts/validate-pins.md) — enforce full-version pins in package.json.
- [validate-action-pins.mjs](scripts/validate-action-pins.md) — enforce commit-SHA pins on GitHub Actions.
- [validate-anchor-uniqueness.mjs](scripts/validate-anchor-uniqueness.md) — report per-file edit fragility (anchor uniqueness); POC for the agent-legibility epic.
- [check-release-age.mjs](scripts/check-release-age.md) — fail a PR that introduces a package version younger than the cooldown window.

### Subsystems

- [Deployment config](subsystems/deployment-config.md) — how public env config is stored, validated, and synced, and how secrets are kept out and rotated.
