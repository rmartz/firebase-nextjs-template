#!/usr/bin/env node
/**
 * Enforces that the docs/ tree is fully navigable through its OKF `index.md`
 * files, so a reader can reach any page by following links from docs/index.md.
 *
 * A directory is "documented" when it directly contains at least one `.md`
 * file. For every documented directory this check requires that:
 *   1. The directory has an `index.md`.
 *   2. Every content page in it (every `.md` other than `index.md`) is linked
 *      from that directory's `index.md`.
 *   3. Every documented sub-directory's `index.md` is linked from its parent
 *      documented directory's `index.md`.
 *
 * (1) + (3) make every index reachable from docs/index.md by induction, and (2)
 * lists every page under some reachable index — e.g. docs/index.md →
 * scripts/index.md → scripts/validate-docs.md.
 *
 * Only local `.md` link targets are considered; external, anchor, and non-md
 * links are ignored. Exits 0 when the tree is navigable, 1 otherwise.
 */

import { readdirSync, readFileSync } from "fs";
import { join, dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "docs");
const INDEX = "index.md";
const rel = (abs) => relative(root, abs);

function markdownFiles() {
  return readdirSync(docsDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Absolute paths of every local .md file an index.md links to. */
function linkedMdTargets(indexPath) {
  const content = readFileSync(indexPath, "utf8");
  const targets = new Set();
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].trim().split("#")[0];
    if (!href || /^[a-z]+:/i.test(href) || !href.endsWith(".md")) continue;
    targets.add(resolve(dirname(indexPath), href));
  }
  return targets;
}

/** Nearest ancestor directory (up to docs/) that is itself documented. */
function parentDocumentedDir(dir, documented) {
  let current = dirname(dir);
  while (current.startsWith(docsDir)) {
    if (documented.has(current)) return current;
    if (current === docsDir) break;
    current = dirname(current);
  }
  return undefined;
}

function main() {
  const files = markdownFiles();
  if (files.length === 0) {
    console.log("docs/ — no pages to index");
    return;
  }

  // Group content pages by directory; every such directory is "documented".
  const contentByDir = new Map();
  for (const file of files) {
    const dir = dirname(file);
    if (!contentByDir.has(dir)) contentByDir.set(dir, []);
    if (!file.endsWith(`/${INDEX}`)) contentByDir.get(dir).push(file);
  }
  const documented = new Set(contentByDir.keys());
  const violations = [];

  for (const dir of [...documented].sort()) {
    const indexPath = join(dir, INDEX);
    if (!files.includes(indexPath)) {
      violations.push(
        `${rel(dir)}/ is missing an ${INDEX} (needed to index its pages)`,
      );
      continue;
    }
    const linked = linkedMdTargets(indexPath);

    for (const page of contentByDir.get(dir).sort()) {
      if (!linked.has(page))
        violations.push(`${rel(page)} is not linked from ${rel(indexPath)}`);
    }

    const parent = parentDocumentedDir(dir, documented);
    if (parent === undefined) continue; // the bundle root
    const parentIndex = join(parent, INDEX);
    if (
      files.includes(parentIndex) &&
      !linkedMdTargets(parentIndex).has(indexPath)
    ) {
      violations.push(
        `${rel(indexPath)} is not linked from its parent index ${rel(parentIndex)}`,
      );
    }
  }

  if (violations.length > 0) {
    console.error("Docs index navigability violations:\n");
    for (const v of violations.sort()) console.error(`  ✗ ${v}`);
    console.error(
      `\n${violations.length} violation(s). Every page must be reachable from docs/index.md via index.md links.`,
    );
    process.exit(1);
  }

  console.log(
    `docs/ — ${documented.size} indexed director(ies), all pages reachable`,
  );
}

main();
