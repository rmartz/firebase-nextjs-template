#!/usr/bin/env node
/**
 * Enforces the full-version pin rule from AGENTS.md: every registry dependency
 * in package.json must specify a full [major].[minor].[patch] base, even with a
 * `^` / `~` range operator (e.g. `^3.8.4`, never `^3` or `^3.8`).
 *
 * A bare-major range lets Dependabot satisfy a bump via the lockfile alone with
 * no package.json diff, hiding the update from review — the failure mode where a
 * Prettier minor bump reformats the codebase and surfaces only as a red CI check.
 *
 * Non-registry specifiers (git/URL, file:, link:, workspace:, catalog:, npm:
 * aliases) carry no semver range and are skipped. Exits 1 with a per-offender
 * report if any pin is not a full version.
 */

import { readFileSync } from "fs";

const sections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

// Full semver base: major.minor.patch, optionally with a prerelease/build suffix.
const fullVersion = /^\d+\.\d+\.\d+(?:[-+].*)?$/;

// Specifiers that are not a registry semver range — nothing to enforce.
const nonRegistry =
  /^(?:github:|git\+|git:|https?:|file:|link:|portal:|workspace:|catalog:|npm:)/;

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const violations = [];
for (const section of sections) {
  for (const [name, range] of Object.entries(pkg[section] ?? {})) {
    if (nonRegistry.test(range)) continue;
    const base = range.replace(/^[\^~]/, "");
    if (!fullVersion.test(base)) {
      violations.push(`${section} / ${name} / "${range}"`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    "package.json pins must specify a full [major].[minor].[patch] base (a `^`/`~` operator is fine):",
  );
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    '\nExpand each to its resolved full version, e.g. "^3" -> "^3.8.4", so Dependabot bumps show up as a package.json change.',
  );
  process.exit(1);
}

console.log("All package.json pins specify a full version.");
