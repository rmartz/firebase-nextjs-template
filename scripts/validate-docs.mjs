#!/usr/bin/env node
/**
 * Validates the OKF (Open Knowledge Format) reference pages under docs/.
 *
 * For every docs/**\/*.md page it checks that:
 *   1. The file begins with a YAML frontmatter block (--- ... ---).
 *   2. The frontmatter has a `type` in the allowed vocabulary.
 *   3. If a `resource:` field is present, the path it names exists in the repo.
 *
 * Frontmatter is parsed directly (no dependency), the same way
 * validate-config.mjs parses the constrained YAML used in deployment/.
 *
 * Exits 0 if every page is conformant, 1 if any violations are found.
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "docs");

// Canonical OKF `type` vocabulary for this repo (see docs/README.md).
const ALLOWED_TYPES = ["Index", "Script", "Subsystem"];

function parseFrontmatter(content) {
  // Returns the key/value map from the leading --- ... --- block, or undefined
  // when the file does not open with a frontmatter fence. Only scalar values
  // are needed (type, resource); list values like tags are ignored.
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return undefined;

  const result = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") return result;
    const line = lines[i];
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line
      .slice(colonIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) result[key] = value;
  }
  // No closing fence found — treat as malformed (no frontmatter).
  return undefined;
}

function validatePage(absPath) {
  const relPath = relative(root, absPath);
  const frontmatter = parseFrontmatter(readFileSync(absPath, "utf8"));

  if (!frontmatter) {
    return [`  MISSING  frontmatter  (no leading --- ... --- block)`];
  }

  const errors = [];
  const { type, resource } = frontmatter;

  if (!type) {
    errors.push(`  MISSING  type  (required OKF frontmatter field)`);
  } else if (!ALLOWED_TYPES.includes(type)) {
    errors.push(
      `  INVALID  type: ${type}  (allowed: ${ALLOWED_TYPES.join(", ")})`,
    );
  }

  if (resource && !existsSync(join(root, resource))) {
    errors.push(
      `  MISSING  resource: ${resource}  (path does not exist in the repo)`,
    );
  }

  return errors.map((e) => `${relPath}\n${e}`);
}

const pages = readdirSync(docsDir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();

let anyErrors = false;
for (const page of pages) {
  const errors = validatePage(page);
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    anyErrors = true;
  }
}

if (anyErrors) {
  console.error(
    "\nFix the violations above. See docs/README.md for the OKF frontmatter spec.",
  );
  process.exit(1);
}

console.log(`docs/ — ${pages.length} page(s) OK`);
