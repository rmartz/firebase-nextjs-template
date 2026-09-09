#!/usr/bin/env node
/**
 * Validates the OKF (Open Knowledge Format, v0.2) reference pages under docs/.
 *
 * Content pages (every docs/**\/*.md that is not an index.md) must:
 *   1. Begin with a YAML frontmatter block (--- ... ---).
 *   2. Carry a non-empty `type` in this repo's vocabulary (see docs/okf-format.md).
 *   3. Name a `resource:` that exists in the repo, when the field is present.
 *   4. Conform, when the optional lifecycle / trust / provenance fields are
 *      present, to the OKF constraints for them (status enum, ISO-8601
 *      timestamps, actor-format producers, required sub-keys). Unknown keys are
 *      tolerated per the spec — consumers must not reject unrecognized fields.
 *
 * `index.md` files are the OKF directory index and are handled separately by
 * validate-docs-index.mjs (reachability). Per the spec they carry no
 * frontmatter, except the bundle-root docs/index.md which may carry only an
 * `okf_version` key; this validator enforces that shape and nothing more.
 *
 * Frontmatter is parsed with the `yaml` package because the trust/provenance
 * families are nested objects and lists that a scalar-only parser cannot read.
 *
 * Exits 0 if every page is conformant, 1 if any violations are found.
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { join, dirname, relative, basename } from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "docs");

// Canonical OKF `type` vocabulary for this repo's content pages.
const ALLOWED_TYPES = ["Script", "Subsystem"];
const STATUSES = ["deprecated", "draft", "stable"];

// ISO-8601 datetime with an explicit UTC offset, e.g. 2026-06-30T14:00:00Z.
const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
// Actor convention: <producer>/<version>, human:<id>, or process:<id>.
const ACTOR = /^(?:human:\S.*|process:\S.*|[^\s:/]+\/\S+)$/;

function extractFrontmatter(content) {
  // Returns { present, malformed, raw } — raw is the text between the leading
  // fences, or undefined when the file does not open with a --- ... --- block.
  // malformed is true when an opening fence exists but no closing fence follows.
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---")
    return { present: false, malformed: false, raw: undefined };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      return {
        present: true,
        malformed: false,
        raw: lines.slice(1, i).join("\n"),
      };
    }
  }
  return { present: false, malformed: true, raw: undefined }; // no closing fence
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkTimestamp(errors, label, value) {
  if (
    value !== undefined &&
    !(typeof value === "string" && ISO_8601.test(value))
  ) {
    errors.push(
      `${label} must be an ISO-8601 datetime with offset (e.g. 2026-06-30T14:00:00Z)`,
    );
  }
}

function checkActor(errors, label, value) {
  if (
    value !== undefined &&
    !(typeof value === "string" && ACTOR.test(value))
  ) {
    errors.push(
      `${label} must use actor format (<producer>/<version>, human:<id>, or process:<id>)`,
    );
  }
}

function checkGenerated(errors, generated) {
  if (generated === undefined) return;
  if (!isPlainObject(generated)) {
    errors.push("generated must be a mapping with a required `by`");
    return;
  }
  if (generated.by === undefined) errors.push("generated.by is required");
  else checkActor(errors, "generated.by", generated.by);
  checkTimestamp(errors, "generated.at", generated.at);
}

function checkVerified(errors, verified) {
  if (verified === undefined) return;
  const entries = Array.isArray(verified) ? verified : [verified];
  for (const [i, entry] of entries.entries()) {
    const label = Array.isArray(verified) ? `verified[${i}]` : "verified";
    if (!isPlainObject(entry)) {
      errors.push(`${label} must be a { by, at } mapping`);
      continue;
    }
    checkActor(errors, `${label}.by`, entry.by);
    checkTimestamp(errors, `${label}.at`, entry.at);
  }
}

function checkSources(errors, sources) {
  if (sources === undefined) return;
  if (!Array.isArray(sources)) {
    errors.push("sources must be a list of objects");
    return;
  }
  for (const [i, source] of sources.entries()) {
    if (!isPlainObject(source)) {
      errors.push(
        `sources[${i}] must be an object with a required \`resource\``,
      );
      continue;
    }
    if (source.resource === undefined)
      errors.push(`sources[${i}].resource is required`);
    checkActor(errors, `sources[${i}].author`, source.author);
    checkTimestamp(errors, `sources[${i}].last_modified`, source.last_modified);
  }
}

function checkResourceObject(errors, label, value) {
  if (value === undefined) return;
  if (!isPlainObject(value) || value.resource === undefined) {
    errors.push(`${label} must be an object with a required \`resource\``);
  }
}

function validateContentFields(errors, frontmatter) {
  const { type, resource, status, tags, stale_after, usage_window } =
    frontmatter;

  if (!type) errors.push("MISSING type (required OKF frontmatter field)");
  else if (!ALLOWED_TYPES.includes(type))
    errors.push(`INVALID type: ${type} (allowed: ${ALLOWED_TYPES.join(", ")})`);

  if (resource !== undefined) {
    if (typeof resource !== "string") {
      errors.push("resource must be a string (repo-relative path)");
    } else {
      const resolved = join(root, resource);
      if (relative(root, resolved).startsWith("..")) {
        errors.push(`resource path escapes the repo root: ${resource}`);
      } else if (!existsSync(resolved)) {
        errors.push(
          `MISSING resource: ${resource} (path does not exist in the repo)`,
        );
      }
    }
  }

  if (status !== undefined && !STATUSES.includes(status))
    errors.push(`INVALID status: ${status} (allowed: ${STATUSES.join(", ")})`);

  if (
    tags !== undefined &&
    !(Array.isArray(tags) && tags.every((t) => typeof t === "string"))
  )
    errors.push("tags must be a list of strings");

  checkTimestamp(errors, "stale_after", stale_after);
  checkGenerated(errors, frontmatter.generated);
  checkVerified(errors, frontmatter.verified);
  checkSources(errors, frontmatter.sources);
  checkResourceObject(errors, "executor", frontmatter.executor);
  checkResourceObject(errors, "attester", frontmatter.attester);

  if (usage_window !== undefined) {
    if (!isPlainObject(usage_window))
      errors.push("usage_window must be a { from, to } mapping");
    else {
      checkTimestamp(errors, "usage_window.from", usage_window.from);
      checkTimestamp(errors, "usage_window.to", usage_window.to);
    }
  }
}

function validateIndex(errors, relPath, fm) {
  // The bundle root may carry only `okf_version`; every other index.md carries none.
  const isBundleRoot = relPath === "docs/index.md";
  if (fm.malformed) {
    errors.push(
      "index.md has a malformed frontmatter block (opening --- without closing ---)",
    );
    return;
  }
  if (!fm.present) return;
  if (!isBundleRoot) {
    errors.push(
      "index.md must not carry frontmatter (it is the OKF directory index)",
    );
    return;
  }
  let parsed;
  try {
    parsed = parseYaml(fm.raw);
  } catch {
    errors.push("bundle-root index.md has invalid YAML frontmatter");
    return;
  }
  if (!isPlainObject(parsed)) {
    errors.push("bundle-root index.md frontmatter must be a YAML mapping");
    return;
  }
  const extra = Object.keys(parsed).filter((k) => k !== "okf_version");
  if (extra.length > 0)
    errors.push(
      `bundle-root index.md may carry only \`okf_version\` (found: ${extra.join(", ")})`,
    );
}

function validatePage(absPath) {
  const relPath = relative(root, absPath);
  const fm = extractFrontmatter(readFileSync(absPath, "utf8"));
  const errors = [];

  if (basename(absPath) === "index.md") {
    validateIndex(errors, relPath, fm);
  } else if (fm.malformed) {
    errors.push("frontmatter block is not closed (missing closing ---)");
  } else if (!fm.present) {
    errors.push("MISSING frontmatter (no leading --- ... --- block)");
  } else {
    let parsed;
    try {
      parsed = parseYaml(fm.raw);
    } catch {
      errors.push("frontmatter contains invalid YAML");
      return errors.map((e) => `${relPath}\n  ${e}`);
    }
    if (!isPlainObject(parsed))
      errors.push("frontmatter must be a YAML mapping");
    else validateContentFields(errors, parsed);
  }

  return errors.map((e) => `${relPath}\n  ${e}`);
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
    "\nFix the violations above. See docs/okf-format.md for the OKF frontmatter spec.",
  );
  process.exit(1);
}

console.log(`docs/ — ${pages.length} page(s) OK`);
