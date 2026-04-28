#!/usr/bin/env bash
# Pushes public environment config from a deployment YAML to Vercel.
#
# Usage:
#   scripts/deploy-config.sh --env=preview
#   scripts/deploy-config.sh --env=production
#
# Reads deployment/{env}.yml and upserts every variable in the variables: block
# to the corresponding Vercel environment via the REST API (atomic upsert —
# no remove-then-add window where the variable is temporarily absent).
#
# To update the YAML first and then push, use update-config.sh --sync.
#
# Requires: node, pnpm (vercel as devDependency), .vercel/project.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment"

# ── Argument parsing ──────────────────────────────────────────────────────────

ENV_NAME=""

for arg in "$@"; do
  case "$arg" in
    --env=*) ENV_NAME="${arg#--env=}" ;;
    *) echo "ERROR: Unknown argument: $arg"; exit 1 ;;
  esac
done

if [[ -z "$ENV_NAME" ]]; then
  echo "ERROR: --env=<preview|production> is required."
  exit 1
fi

CONFIG_FILE="$DEPLOYMENT_DIR/$ENV_NAME.yml"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: $CONFIG_FILE not found."
  exit 1
fi

# ── Prerequisites ─────────────────────────────────────────────────────────────

if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found. Install from https://pnpm.io/installation"
  exit 1
fi

if ! pnpm exec vercel whoami &>/dev/null 2>&1; then
  echo "ERROR: Not authenticated with Vercel. Run: pnpm exec vercel login"
  exit 1
fi

VERCEL_PROJECT_JSON="$PROJECT_ROOT/.vercel/project.json"
if [[ ! -f "$VERCEL_PROJECT_JSON" ]]; then
  echo "ERROR: .vercel/project.json not found. Run: pnpm exec vercel link"
  exit 1
fi

# ── Map env name to Vercel environment ────────────────────────────────────────

case "$ENV_NAME" in
  preview)    VERCEL_ENV="preview" ;;
  production) VERCEL_ENV="production" ;;
  *)
    echo "ERROR: Unknown environment '$ENV_NAME'. Expected: preview or production."
    exit 1
    ;;
esac

# ── Validate before pushing ───────────────────────────────────────────────────

echo "Validating $ENV_NAME config against schema..."
node "$SCRIPT_DIR/validate-config.mjs" --env="$ENV_NAME"
echo ""

# ── Push variables to Vercel ──────────────────────────────────────────────────

echo "Deploying $ENV_NAME config to Vercel ($VERCEL_ENV environment)..."
echo ""

node - "$PROJECT_ROOT" "$CONFIG_FILE" "$VERCEL_ENV" <<'NODE'
const fs = require('fs');
const https = require('https');
const path = require('path');

const [,, projectRoot, configFile, vercelEnv] = process.argv;

// Load project ID
const projectJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, '.vercel', 'project.json'), 'utf8')
);
const projectId = projectJson.projectId;
if (!projectId) {
  process.stderr.write('ERROR: projectId missing from .vercel/project.json\n');
  process.exit(1);
}

// Load auth token from Vercel CLI config
const authPaths = [
  path.join(process.env.HOME, 'Library', 'Application Support', 'com.vercel.cli', 'auth.json'),
  path.join(process.env.HOME, '.local', 'share', 'com.vercel.cli', 'auth.json'),
  path.join(process.env.HOME, '.vercel', 'auth.json'),
];
let token;
for (const p of authPaths) {
  try {
    const auth = JSON.parse(fs.readFileSync(p, 'utf8'));
    token = auth.token;
    if (token) break;
  } catch {}
}
if (!token) {
  process.stderr.write(
    'ERROR: Could not read Vercel auth token.\n' +
    'Run: pnpm exec vercel login\n'
  );
  process.exit(1);
}

// Parse variables: block from YAML
const content = fs.readFileSync(configFile, 'utf8');
const variables = {};
let inVars = false;
for (const rawLine of content.split('\n')) {
  const line = rawLine.replace(/#.*$/, '');
  const trimmed = line.trim();
  if (trimmed === 'variables:') { inVars = true; continue; }
  if (inVars) {
    if (trimmed && !line.startsWith(' ')) { inVars = false; continue; }
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)/);
    if (m && !rawLine.trim().startsWith('#')) {
      variables[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function upsert(key, value) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ key, value, type: 'plain', target: [vercelEnv] });
    const options = {
      hostname: 'api.vercel.com',
      path: `/v10/projects/${projectId}/env?upsert=true`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          let msg = data;
          try { msg = JSON.parse(data).error?.message ?? data; } catch {}
          reject(new Error(`HTTP ${res.statusCode}: ${msg}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  let pushed = 0;
  let failed = 0;
  for (const [key, value] of Object.entries(variables)) {
    try {
      await upsert(key, value);
      process.stdout.write(`  Pushed ${key}\n`);
      pushed++;
    } catch (e) {
      process.stderr.write(`  FAILED ${key}: ${e.message}\n`);
      failed++;
    }
  }
  process.stdout.write('\n');
  if (failed > 0) {
    process.stderr.write(`ERROR: ${failed} variable(s) failed to push.\n`);
    process.exit(1);
  }
  process.stdout.write(`Done — ${pushed} variable(s) pushed to Vercel (${vercelEnv}).\n`);
  process.stdout.write('Trigger a new deployment to apply the updated values.\n');
})();
NODE
