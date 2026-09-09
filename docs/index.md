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

Both the frontmatter and the navigability of this tree are enforced in CI — see
[validate-docs.mjs](scripts/validate-docs.md) and
[validate-docs-index.mjs](scripts/validate-docs-index.md).
