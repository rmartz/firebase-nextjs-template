#!/usr/bin/env node
/**
 * Enforces SHA-pinning for third-party GitHub Actions — the supply-chain
 * analogue of the full-version package.json pin rule. Every *remote* `uses:`
 * reference in .github/workflows/*.yml and .github/actions/*\/action.yml must pin
 * a full 40-char commit SHA with a trailing version comment, e.g.
 *
 *   uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
 *
 * A mutable tag (`@v7`) can be silently repointed at attacker-controlled code —
 * which CI would then run with the workflow token — so a tag is not a safe pin.
 * The trailing `# <version>` comment is Dependabot's convention: it reads the
 * version from there and bumps the SHA and comment together on updates.
 *
 * Local composite refs (`./…`) are in-repo — no external tag to repoint — and
 * are skipped. Exits 1 with a per-offender report if any remote action is not
 * pinned to a SHA, or is SHA-pinned but missing its version comment.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const roots = [".github/workflows", ".github/actions"];
const sha = /^[0-9a-f]{40}$/;
const usesLine = /^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/;
// The trailing comment must carry a full [major].[minor].[patch] version
// (e.g. `# v7.0.0`, `v` optional; a prerelease/build suffix is allowed), not
// just any text and not a partial version. Dependabot reads this version to
// track the SHA pin, and a precise version is the unambiguous anchor: a partial
// comment (`# v7`) lands in the SHA-pin comment-parsing path where Dependabot's
// behavior is buggy/ambiguous, and can leave within-major updates unproposed.
// This mirrors the full-version rule for package.json pins (validate-pins.mjs).
const versionComment = /#\s*v?\d+\.\d+\.\d+/;

function collectYaml(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return collectYaml(path);
    return /\.ya?ml$/.test(entry) ? [path] : [];
  });
}

const violations = [];
for (const root of roots) {
  for (const file of collectYaml(root)) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const match = usesLine.exec(line);
        if (!match) return;
        const ref = match[1].replace(/^['"]|['"]$/g, "");
        // In-repo composite actions carry no external tag to repoint.
        if (ref.startsWith("./") || ref.startsWith("../")) return;
        const where = `${file}:${index + 1}`;
        const pin = ref.slice(ref.lastIndexOf("@") + 1);
        if (!ref.includes("@") || !sha.test(pin)) {
          violations.push(
            `${where}  ${ref}  — not pinned to a 40-char commit SHA`,
          );
        } else if (!versionComment.test(match[2])) {
          violations.push(
            `${where}  ${ref}  — SHA pin needs a full-version comment (e.g. \`# v7.0.0\`, not \`# v7\`) so Dependabot tracks it`,
          );
        }
      });
  }
}

if (violations.length > 0) {
  console.error(
    "GitHub Actions must be pinned to a full commit SHA with a version comment (e.g. `uses: actions/checkout@<40-char-sha> # v7.0.0`):",
  );
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    "\nA mutable tag can be repointed at malicious code. Resolve the tag to its commit SHA and add the version as a trailing comment (Dependabot then updates both together).",
  );
  process.exit(1);
}

console.log("All GitHub Actions are pinned to a commit SHA.");
