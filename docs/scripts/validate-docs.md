---
type: Script
title: validate-docs.mjs
description: Validates the OKF frontmatter on every docs/ page and checks that each resource path still exists.
resource: scripts/validate-docs.mjs
tags: [docs, okf, validation, ci]
---

# validate-docs.mjs

Validates the [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) reference pages under `docs/`, so the frontmatter directive in `CLAUDE.md` is mechanically enforced rather than relying on convention. This is what catches a page whose `resource:` points at a file that has since been deleted.

## Usage

```bash
node scripts/validate-docs.mjs
pnpm run docs:validate
```

It also runs in CI as the **Docs (OKF)** job in `.github/workflows/ci-actions.yml`.

## What it checks

For every `docs/**/*.md` page:

1. The file opens with a YAML frontmatter block (`---` … `---`).
2. The frontmatter has a `type` in the allowed vocabulary (`Index`, `Script`, `Subsystem`).
3. If a `resource:` field is present, the path it names exists in the repo. (Optional, per OKF — only validated when set; the `Index` page has none.)

Frontmatter is parsed directly with no extra dependency, the same approach [validate-config.mjs](validate-config.md) uses for the constrained YAML under `deployment/`. Exits 0 when every page is conformant, 1 with a per-file report otherwise.

## Requires

- `node`

## Related

- [Documentation index](../README.md) — the OKF frontmatter spec and `type` vocabulary this enforces.
- [validate-config.mjs](validate-config.md) — the deployment-config validator this mirrors.
