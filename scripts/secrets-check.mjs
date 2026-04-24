#!/usr/bin/env node
/**
 * Pre-commit secrets check. Runs two guards in sequence:
 *   1. Validates deployment config files against deployment/schema.yml
 *   2. Scans staged files for secrets via gitleaks (if installed)
 *
 * Designed to be invoked via `pnpm run secrets-check`.
 * Intended to be called from .husky/pre-commit alongside lint-staged.
 */

import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── 1. Deployment config validation ──────────────────────────────────────────

const validateScript = join(root, "scripts", "validate-config.mjs");
if (existsSync(validateScript)) {
  try {
    execSync(`node "${validateScript}"`, { stdio: "inherit", cwd: root });
  } catch {
    process.exit(1);
  }
}

// ── 2. Gitleaks secret scan ───────────────────────────────────────────────────

const gitleaks = spawnSync("which", ["gitleaks"], { encoding: "utf8" });
if (gitleaks.status !== 0) {
  console.warn(
    "\nWARNING: gitleaks not installed — secret scanning skipped.\n" +
      "  Install with: brew install gitleaks\n" +
      "  Secrets will still be caught by CI, but local detection is strongly recommended.\n",
  );
  process.exit(0);
}

const result = spawnSync(
  "gitleaks",
  ["protect", "--staged", "--config", ".gitleaks.toml", "--redact"],
  { stdio: "inherit", cwd: root },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
