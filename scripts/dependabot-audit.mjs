#!/usr/bin/env node
/**
 * Dependabot grouping-outcome audit.
 *
 * Reconstructs, from the GitHub API, how every Dependabot PR in the repository
 * turned out — merged cleanly, needed a human fix to unblock, still stuck, or
 * routine Dependabot supersede-churn — attributes each to its Dependabot group,
 * and prints a per-group intervention-rate report as markdown.
 *
 * This is the standing instrument behind issue #222: it turns "which groups are
 * worth keeping?" into a measured question. A group whose ungrouped members
 * start needing fixes has earned a group; a group that never needs one is a
 * candidate to drop.
 *
 * Usage:
 *   node scripts/dependabot-audit.mjs [--repo owner/name] [--out report.md]
 *
 * Repo resolution: --repo → GH_REPO → GITHUB_REPOSITORY → `gh repo view`.
 * Requires the `gh` CLI, authenticated (GITHUB_TOKEN in CI).
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// Groups Dependabot can name in a PR title — both current active groups and
// removed historical ones. Historical names (storybook, eslint, tailwind) must
// be kept here so that past PRs referencing those groups are classified
// correctly; this list is NOT a mirror of the current .github/dependabot.yml.
const KNOWN_GROUPS = [
  "dev-dependencies",
  "eslint",
  "prettier",
  "production-dependencies",
  "react",
  "storybook",
  "tailwind",
  "typescript",
  "vite",
];

const CLEAN = "clean";
const NEEDED_FIX = "needed-fix";
const STUCK = "stuck";
const PENDING = "pending";
const CHURN = "churn";

function gh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function resolveRepo(argRepo) {
  const repo = argRepo || process.env.GH_REPO || process.env.GITHUB_REPOSITORY;
  if (repo) return repo;
  return JSON.parse(gh(["repo", "view", "--json", "nameWithOwner"]))
    .nameWithOwner;
}

// Which Dependabot group a PR title belongs to. "bump the <x> group ...",
// "... in the <x> group ..." → <x>; an "owner/repo" bump (no leading @) is a
// GitHub Actions ecosystem bump; anything else is an ungrouped single package.
function groupOf(title) {
  const named = title.match(/\bthe ([a-z][a-z-]*) group\b/i);
  if (named && KNOWN_GROUPS.includes(named[1].toLowerCase())) {
    return named[1].toLowerCase();
  }
  if (/\bbump (?!@)[\w.-]+\/[\w.-]+/i.test(title)) return "github-actions";
  // Map removed-family package names to their family bucket so that future
  // individual bumps of these packages remain attributable after the groups
  // were pruned from .github/dependabot.yml.
  if (/\bstorybook\b/i.test(title)) return "storybook";
  if (/\beslint\b/i.test(title)) return "eslint";
  if (/\btailwindcss\b/i.test(title)) return "tailwind";
  return "individual";
}

// Map each Dependabot PR number to the merged fix/unblock PRs that target it.
// Two precise signals, matching the repo's conventions, keep incidental
// mentions out (a churn-cluster narrative citing bare `#180`, a cross-repo
// `owner/repo#63`) and only count fixes that actually landed:
//   (a) the explicit "Dependabot #N" / "Dependabot PR #N" token, and
//   (b) a lockfile-corruption repair (title says lockfile/corrupt) naming the
//       culprit merge by a bare `#N` that is not part of an `owner/repo#N` slug.
// Only MERGED PRs count, so a closed investigation that concluded "no code fix
// needed" (e.g. an infra failure) does not flag its Dependabot PR.
function fixReferences(otherPrs, dependabotNums) {
  const refs = new Map();
  const add = (num, fixPr) => {
    if (!dependabotNums.has(num)) return;
    if (!refs.has(num)) refs.set(num, []);
    if (!refs.get(num).includes(fixPr)) refs.get(num).push(fixPr);
  };
  for (const pr of otherPrs) {
    if (pr.state !== "MERGED") continue;
    const text = `${pr.title}\n${pr.body || ""}`;
    for (const m of text.matchAll(/\bdependabot(?: pr)? #(\d+)/gi)) {
      add(Number(m[1]), pr.number);
    }
    if (/\b(lockfile|corrupt)/i.test(pr.title)) {
      for (const m of text.matchAll(/(?<![\w/-])#(\d+)/g))
        add(Number(m[1]), pr.number);
    }
  }
  return refs;
}

function isRed(rollup) {
  return (rollup || []).some(
    (c) =>
      c.conclusion === "FAILURE" ||
      c.conclusion === "TIMED_OUT" ||
      c.conclusion === "STARTUP_FAILURE" ||
      c.state === "FAILURE" ||
      c.state === "ERROR",
  );
}

function outcomeOf(pr, fixRefs) {
  if (fixRefs.has(pr.number)) return NEEDED_FIX;
  if (pr.state === "MERGED") return CLEAN;
  if (pr.state === "OPEN") return isRed(pr.statusCheckRollup) ? STUCK : PENDING;
  return CHURN; // CLOSED and never merged, no landed fix → Dependabot supersede-churn
}

// Pure classification: given the Dependabot PRs, the other PRs, and the repo
// slug, produce { rows, groups } ready for rendering. Exported for testing.
export function buildReport(dependabotPrs, otherPrs) {
  const nums = new Set(dependabotPrs.map((p) => p.number));
  const fixRefs = fixReferences(otherPrs, nums);
  // Fix PRs that repaired lockfile corruption — a merge-mechanics failure that
  // is independent of which group happened to merge, flagged so its rows are
  // not misread as a grouping signal.
  const lockfileFixers = new Set(
    otherPrs
      .filter(
        (pr) => pr.state === "MERGED" && /\b(lockfile|corrupt)/i.test(pr.title),
      )
      .map((pr) => pr.number),
  );
  const rows = dependabotPrs.map((pr) => {
    const fixes = fixRefs.get(pr.number) || [];
    return {
      number: pr.number,
      title: pr.title,
      group: groupOf(pr.title),
      outcome: outcomeOf(pr, fixRefs),
      fixes,
      mechanics: fixes.length > 0 && fixes.every((f) => lockfileFixers.has(f)),
    };
  });

  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.group)) {
      groups.set(row.group, {
        clean: 0,
        [NEEDED_FIX]: 0,
        stuck: 0,
        pending: 0,
        churn: 0,
        mechanics: 0,
      });
    }
    const bucket = groups.get(row.group);
    if (row.mechanics && row.outcome === NEEDED_FIX) {
      bucket.mechanics += 1;
    } else {
      bucket[row.outcome === CLEAN ? "clean" : row.outcome] += 1;
    }
  }
  return { rows, groups };
}

function rate(bucket) {
  const interventions = bucket[NEEDED_FIX] + bucket.stuck;
  const decided = bucket.clean + interventions;
  if (decided === 0) return { interventions, decided, label: "—" };
  return {
    interventions,
    decided,
    label: `${Math.round((interventions / decided) * 100)}% (${interventions}/${decided})`,
  };
}

function renderMarkdown({ rows, groups }, repo) {
  const url = (n) => `https://github.com/${repo}/pull/${n}`;
  const link = (n) => `[#${n}](${url(n)})`;
  const total = rows.length;
  const interventions = rows.filter(
    (r) => r.outcome === NEEDED_FIX || r.outcome === STUCK,
  );
  const clean = rows.filter((r) => r.outcome === CLEAN).length;
  const churn = rows.filter((r) => r.outcome === CHURN).length;

  const lines = [];
  lines.push(`# Dependabot grouping audit — ${repo}`);
  lines.push("");
  lines.push(
    `_Generated ${new Date().toISOString()} · ${total} Dependabot PRs analyzed._`,
  );
  lines.push("");
  lines.push(
    `**${clean} clean** · **${interventions.length} needed intervention** · ` +
      `${churn} routine supersede-churn (excluded from rates).`,
  );
  lines.push("");
  lines.push("## Per-group intervention rate");
  lines.push("");
  lines.push(
    "Intervention = needed a merged fix PR (excluding lockfile-repair mechanics), or open-and-red. Churn, pending PRs, and mechanics fixes are excluded from the denominator.",
  );
  lines.push("");
  lines.push(
    "| Group | Clean | Needed fix | Stuck | Mechanics | Churn | Pending | Intervention rate |",
  );
  lines.push("| --- | --: | --: | --: | --: | --: | --: | --- |");
  for (const [name, bucket] of [...groups.entries()].sort()) {
    const r = rate(bucket);
    lines.push(
      `| \`${name}\` | ${bucket.clean} | ${bucket[NEEDED_FIX]} | ${bucket.stuck} | ${bucket.mechanics} | ${bucket.churn} | ${bucket.pending} | ${r.label} |`,
    );
  }
  lines.push("");
  lines.push("## Interventions");
  lines.push("");
  if (interventions.length === 0) {
    lines.push("_None._");
  } else {
    for (const row of interventions.sort((a, b) => a.number - b.number)) {
      const tag =
        row.outcome === STUCK
          ? "open, red"
          : `fixed by ${row.fixes.map(link).join(", ")}`;
      const mechanics = row.mechanics
        ? " · merge-mechanics (group-independent)"
        : "";
      lines.push(
        `- ${link(row.number)} \`${row.group}\` — ${row.title} (${tag})${mechanics}`,
      );
    }
  }
  lines.push("");
  lines.push("---");
  lines.push(
    "_Method: a Dependabot PR is `needed-fix` when a MERGED fix/unblock PR references it, " +
      "`stuck` when open with a failing check, `churn` when Dependabot auto-closed it (routine " +
      "recreate — assumed, not verified per-PR), else `clean`. Generated by " +
      "`scripts/dependabot-audit.mjs`._",
  );
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = { repo: undefined, out: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo") args.repo = argv[(i += 1)];
    else if (arg.startsWith("--repo=")) args.repo = arg.slice("--repo=".length);
    else if (arg === "--out") args.out = argv[(i += 1)];
    else if (arg.startsWith("--out=")) args.out = arg.slice("--out=".length);
  }
  return args;
}

function fetchPrs(repo, extraFields) {
  const fields = ["number", "title", "state", ...extraFields].join(",");
  return (author) =>
    JSON.parse(
      gh([
        "pr",
        "list",
        "--repo",
        repo,
        "--author",
        author,
        "--state",
        "all",
        "--limit",
        "1000",
        "--json",
        fields,
      ]),
    );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = resolveRepo(args.repo);
  const dependabotPrs = fetchPrs(repo, ["statusCheckRollup"])("app/dependabot");
  const otherPrs = JSON.parse(
    gh([
      "pr",
      "list",
      "--repo",
      repo,
      "--state",
      "all",
      "--limit",
      "1000",
      "--json",
      "number,title,state,body,author",
    ]),
  ).filter(
    (pr) =>
      pr.author?.login !== "app/dependabot" &&
      pr.author?.login !== "dependabot" &&
      pr.author?.login !== "dependabot[bot]",
  );

  const report = buildReport(dependabotPrs, otherPrs);
  const markdown = renderMarkdown(report, repo);
  process.stdout.write(`${markdown}\n`);
  if (args.out) writeFileSync(args.out, `${markdown}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
