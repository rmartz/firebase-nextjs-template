#!/usr/bin/env node
/**
 * Edit-outcome miner — ground truth for the edit-fragility evaluation (#237,
 * epic #161). The fragility score (`validate-anchor-uniqueness.mjs`) claims to
 * predict when an agent will struggle to land an exact-string `Edit`. This
 * mines the other half of that claim: what actually happened when agents edited
 * each file, read from Claude Code session transcripts.
 *
 * Per file it reports the three difficulty signals #237 named:
 *   - failures   — Edit results that failed to anchor ("String to replace not
 *                  found", "Found N matches" / not-unique).
 *   - retries    — a fail-then-reattempt on the SAME file within a session.
 *   - window     — the size of the disambiguating context each Edit had to
 *                  include (the `old_string` length); the continuous proxy for
 *                  "hard to target" that exists even for edits that succeeded.
 *
 * Transcripts live outside the repo (`~/.claude/projects/<encoded-cwd>/*.jsonl`),
 * so paths are normalized back to repo-relative to join against the score.
 *
 * Usage:
 *   node scripts/mine-edit-outcomes.mjs            # human table
 *   node scripts/mine-edit-outcomes.mjs --json     # machine output
 *   node scripts/mine-edit-outcomes.mjs --transcripts <dir>   # override source
 */

import { readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const REPO_MARKER = "firebase-nextjs-template/";
const NOT_FOUND = /String to replace not found/i;
const NOT_UNIQUE = /Found \d+ matches|not unique|multiple matches/i;

/** Classify one Edit tool_result into an outcome bucket. */
export function classifyResult(text, isError) {
  const s = String(text ?? "");
  if (NOT_FOUND.test(s)) return "not_found";
  if (NOT_UNIQUE.test(s)) return "not_unique";
  return isError ? "error" : "ok";
}

/** Map an absolute (possibly worktree) edit path back to a repo-relative path. */
export function normalizePath(filePath) {
  let p = String(filePath ?? "");
  const marker = p.lastIndexOf(REPO_MARKER);
  if (marker !== -1) p = p.slice(marker + REPO_MARKER.length);
  // Drop a `.git-worktrees/<branch>/` prefix (optionally itself nested under a
  // `.claude/worktrees/<id>/` sandbox) so worktree edits join to their source.
  return p.replace(
    /^(?:\.claude\/worktrees\/[^/]+\/)?\.git-worktrees\/[^/]+\//,
    "",
  );
}

const isFailure = (outcome) =>
  outcome === "not_found" || outcome === "not_unique" || outcome === "error";

function resultText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((c) => (typeof c === "string" ? c : (c?.text ?? "")))
      .join("\n");
  return "";
}

function median(nums) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Pair each Edit tool_use with its result, in transcript order. */
export function buildEditEvents(records) {
  const uses = [];
  const results = new Map();
  for (const rec of records) {
    const content = Array.isArray(rec?.message?.content)
      ? rec.message.content
      : [];
    for (const block of content) {
      if (block?.type === "tool_use" && block.name === "Edit") {
        uses.push({
          id: block.id,
          sessionId: rec.sessionId,
          path: normalizePath(block.input?.file_path),
          windowLen: String(block.input?.old_string ?? "").length,
        });
      } else if (block?.type === "tool_result" && block.tool_use_id) {
        results.set(block.tool_use_id, {
          isError: Boolean(block.is_error),
          text: resultText(block.content),
        });
      }
    }
  }
  return uses.map((u) => {
    const r = results.get(u.id);
    return { ...u, outcome: r ? classifyResult(r.text, r.isError) : "ok" };
  });
}

/** Fold edit events into per-file ground-truth stats. */
export function aggregateByFile(events) {
  const byFile = new Map();
  const lastBySession = new Map();
  for (const e of events) {
    let s = byFile.get(e.path);
    if (!s) {
      s = {
        path: e.path,
        edits: 0,
        failures: 0,
        notFound: 0,
        notUnique: 0,
        retries: 0,
        windowSizes: [],
      };
      byFile.set(e.path, s);
    }
    s.edits += 1;
    s.windowSizes.push(e.windowLen);
    if (e.outcome === "not_found") {
      s.failures += 1;
      s.notFound += 1;
    } else if (e.outcome === "not_unique") {
      s.failures += 1;
      s.notUnique += 1;
    } else if (e.outcome === "error") {
      s.failures += 1;
    }
    const prev = lastBySession.get(e.sessionId);
    if (prev && prev.path === e.path && isFailure(prev.outcome)) s.retries += 1;
    lastBySession.set(e.sessionId, { path: e.path, outcome: e.outcome });
  }
  for (const s of byFile.values()) {
    s.medianWindow = median(s.windowSizes);
    s.maxWindow = s.windowSizes.length ? Math.max(...s.windowSizes) : 0;
  }
  return byFile;
}

function defaultTranscriptDirs() {
  const base = join(homedir(), ".claude", "projects");
  try {
    return readdirSync(base)
      .filter((name) => name.includes("firebase-nextjs-template"))
      .map((name) => join(base, name));
  } catch {
    return [];
  }
}

function readRecords(dirs) {
  const records = [];
  for (const dir of dirs) {
    let files;
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const file of files) {
      for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          records.push(JSON.parse(line));
        } catch {
          // Truncated / partial line — skip it, keep mining the rest.
        }
      }
    }
  }
  return records;
}

function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf("--transcripts");
  const dirs =
    at !== -1 && args[at + 1] ? [args[at + 1]] : defaultTranscriptDirs();
  const stats = [
    ...aggregateByFile(buildEditEvents(readRecords(dirs))).values(),
  ]
    .map((s) => ({
      path: s.path,
      edits: s.edits,
      failures: s.failures,
      notFound: s.notFound,
      notUnique: s.notUnique,
      retries: s.retries,
      medianWindow: s.medianWindow,
      maxWindow: s.maxWindow,
    }))
    .sort((a, b) => b.edits - a.edits);

  if (args.includes("--json")) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }
  console.log(
    `Edit outcomes mined from transcripts — ${stats.length} file(s)\n`,
  );
  console.log(
    `  ${"edit".padStart(4)}  ${"fail".padStart(4)}  ${"rtry".padStart(4)}  ${"medW".padStart(5)}  ${"maxW".padStart(5)}  file`,
  );
  for (const s of stats.slice(0, 30)) {
    console.log(
      `  ${String(s.edits).padStart(4)}  ${String(s.failures).padStart(4)}  ${String(s.retries).padStart(4)}  ${String(s.medianWindow).padStart(5)}  ${String(s.maxWindow).padStart(5)}  ${s.path}`,
    );
  }
  const totalFail = stats.reduce((n, s) => n + s.failures, 0);
  console.log(
    `\n  totals: ${stats.reduce((n, s) => n + s.edits, 0)} edits, ${totalFail} anchor failure(s) across ${stats.length} files`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
