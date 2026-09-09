---
type: Subsystem
title: The OKF documentation format
description: How docs/ pages are structured with Open Knowledge Format frontmatter, and the authoritative spec to defer to.
tags: [docs, okf, conventions]
---

# The OKF documentation format

Everything under `docs/` follows Google's **Open Knowledge Format (OKF)** — a
convention for knowledge pages that are equally legible to humans and to agents:
a markdown file whose body is prose and whose leading YAML frontmatter carries
structured metadata.

> **Authoritative reference.** This page describes how we _apply_ OKF in this
> repository. For any question about the format itself — field semantics, new
> field families, edge cases — defer to the upstream specification, which is the
> single source of truth:
>
> **<https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md>**
>
> We target **OKF v0.2**. Where this page and the spec disagree, the spec wins;
> open a PR to correct this page.

## Content pages

Every page that documents a script or subsystem is a "content page" and carries
frontmatter delimited by `---` fences at the very top of the file:

```yaml
---
type: Script # required
title: validate-docs.mjs # recommended
description: One-line summary for search snippets and previews. # recommended
resource: scripts/validate-docs.mjs # recommended; repo-relative path to what it documents
tags: [docs, okf] # recommended
---
```

- **`type`** is the only required field. Per the spec it is a free-form,
  self-explanatory string; in this repo we restrict content pages to a small
  curated vocabulary:
  - **Script** — a standalone executable under `scripts/`.
  - **Subsystem** — a cohesive area of the codebase (a directory, a flow, a
    layer) rather than a single file.
- **`title`**, **`description`**, **`resource`**, and **`tags`** are recommended.
  A `resource` must name a path that exists in the repo.

### Optional field families

The spec defines optional **lifecycle**, **trust**, and **provenance** field
families (`status`, `stale_after`, `generated`, `verified`, `sources`,
`usage_window`, `executor`, `attester`). None are required, but when present
they must conform to the spec — for example:

- `status` is one of `draft`, `stable` (the default), or `deprecated`.
- All timestamps are ISO-8601 with an explicit offset (e.g. `2026-06-30T14:00:00Z`).
- Actor-valued fields use `<producer>/<version>`, `human:<id>`, or `process:<id>`.

Unknown keys are always tolerated — consumers must not reject a page for a field
they do not recognize.

## Index pages

Each directory in the bundle carries an **`index.md`** that lists its pages and
links to its sub-directory indexes. Per the spec, `index.md` files carry **no
frontmatter**, with one exception: the bundle-root `docs/index.md` may carry a
single `okf_version` key and nothing else.

The tree must be fully navigable: every content page is linked from its own
directory's `index.md`, and every sub-directory's `index.md` is linked from its
parent's — so any page is reachable by following links from `docs/index.md`
down (e.g. `docs/index.md` → `scripts/index.md` → `scripts/validate-docs.md`).

## Enforcement

Both rules are gated in CI (the **Docs (OKF)** job):

- [validate-docs.mjs](scripts/validate-docs.md) — frontmatter conformance on
  content pages, and the no-frontmatter rule on indexes.
- [validate-docs-index.mjs](scripts/validate-docs-index.md) — navigability of
  the `index.md` tree.

Run them locally with `pnpm run docs:validate` and `pnpm run docs:index`.
