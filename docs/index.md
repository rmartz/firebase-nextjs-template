---
okf_version: "0.2"
---

# Documentation

Reference pages an agent (or human) can retrieve before working on a task. Each
page documents one script or subsystem and follows Google's Open Knowledge
Format (OKF): a markdown file with YAML frontmatter, cross-linked to related
pages via plain markdown links.

This directory is an OKF bundle. Every directory carries an `index.md` that
lists its pages and links to any sub-directory indexes, so any page is reachable
by following links from this file down. Start here:

- [The OKF documentation format](okf-format.md) — how these pages are
  structured, the frontmatter shape, and the authoritative spec.
- [Scripts](scripts/index.md) — reference pages for the executables under
  `scripts/`.
- [Subsystems](subsystems/index.md) — reference pages for cohesive areas of the
  codebase.

The OKF frontmatter of these pages, and this index tree's navigability, are
enforced in CI by the Repo Hygiene workflow (`@rmartz/repo-hygiene`'s `okf` and
`okf-index` checks — run locally with `pnpm run hygiene`).
See [the OKF format](okf-format.md) and
[the repo-hygiene subsystem](subsystems/repo-hygiene.md).
