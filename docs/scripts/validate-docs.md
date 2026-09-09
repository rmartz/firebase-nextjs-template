---
type: Script
title: validate-docs.mjs
description: Validates the OKF frontmatter on every docs/ content page and enforces the no-frontmatter rule on index pages.
resource: scripts/validate-docs.mjs
tags: [docs, okf, validation, ci]
---

# validate-docs.mjs

Validates the [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) frontmatter on the reference pages under `docs/`, so the frontmatter directive in `AGENTS.md` is mechanically enforced rather than relying on convention. See [the OKF format](../okf-format.md) for the rules this enforces.

## Usage

```bash
node scripts/validate-docs.mjs
pnpm run docs:validate
```

It also runs in CI as the **Docs (OKF)** job in `.github/workflows/ci-actions.yml`, alongside [validate-docs-index.mjs](validate-docs-index.md).

## What it checks

For every content page (`docs/**/*.md` that is not an `index.md`):

1. The file opens with a YAML frontmatter block (`---` … `---`).
2. The frontmatter has a non-empty `type` in the allowed vocabulary (`Script`, `Subsystem`).
3. If a `resource:` field is present, the path it names exists in the repo.
4. When the optional lifecycle / trust / provenance fields are present, they conform to the spec: `status` ∈ `draft`/`stable`/`deprecated`; ISO-8601 timestamps with offset; actor-format producers (`<producer>/<version>`, `human:<id>`, `process:<id>`); and the required sub-keys on `generated`, `sources`, `executor`, and `attester`. Unknown keys are tolerated per the spec.

For `index.md` pages it enforces the OKF index convention: the bundle-root `docs/index.md` may carry only an `okf_version` key, and every other `index.md` carries no frontmatter.

Frontmatter is parsed with the `yaml` package because the trust/provenance families are nested objects and lists a scalar-only parser cannot read. Exits 0 when every page is conformant, 1 with a per-file report otherwise.

## Requires

- `node`, and the `yaml` dev dependency (`pnpm install`)

## Related

- [The OKF documentation format](../okf-format.md) — the frontmatter spec and `type` vocabulary this enforces.
- [validate-docs-index.mjs](validate-docs-index.md) — the companion navigability check.
- [validate-config.mjs](validate-config.md) — a sibling standalone validator.
