#!/usr/bin/env bash
# Updates a public environment config file.
#
# Usage:
#   scripts/update-config.sh --env=staging KEY=value [KEY=value ...]
#   scripts/update-config.sh --env=production --firebase-config=/path/to/config.json
#
# The --firebase-config flag accepts the path to a JSON file containing the
# firebaseConfig object exported from the Firebase console. It extracts and maps
# the relevant NEXT_PUBLIC_FIREBASE_* keys automatically.
#
# Sensitive values must NEVER be passed as KEY=value arguments — they will appear
# in shell history and ps output. Use `pnpm exec vercel env add` directly for secrets.
#
# To push the updated YAML values to Vercel, run terraform apply from terraform/:
#   cd terraform && terraform apply
#
# Requires: node

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment"

# ── Argument parsing ──────────────────────────────────────────────────────────

ENV_NAME=""
FIREBASE_CONFIG_FILE=""
declare -a KEY_VALUE_PAIRS=()

for arg in "$@"; do
  case "$arg" in
    --env=*) ENV_NAME="${arg#--env=}" ;;
    --firebase-config=*) FIREBASE_CONFIG_FILE="${arg#--firebase-config=}" ;;
    *=*) KEY_VALUE_PAIRS+=("$arg") ;;
    *) echo "ERROR: Unknown argument: $arg"; exit 1 ;;
  esac
done

if [[ -z "$ENV_NAME" ]]; then
  echo "ERROR: --env=<staging|production> is required."
  exit 1
fi

CONFIG_FILE="$DEPLOYMENT_DIR/$ENV_NAME.yml"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: $CONFIG_FILE not found. Create it first."
  exit 1
fi

# ── Firebase config extraction ────────────────────────────────────────────────

if [[ -n "$FIREBASE_CONFIG_FILE" ]]; then
  if [[ ! -f "$FIREBASE_CONFIG_FILE" ]]; then
    echo "ERROR: Firebase config file not found: $FIREBASE_CONFIG_FILE"
    exit 1
  fi
  echo "Extracting Firebase client config from $FIREBASE_CONFIG_FILE..."
  while IFS="=" read -r key value; do
    KEY_VALUE_PAIRS+=("$key=$value")
  done < <(FIREBASE_CONFIG_PATH="$FIREBASE_CONFIG_FILE" node -e "
    const cfg = JSON.parse(require('fs').readFileSync(process.env.FIREBASE_CONFIG_PATH, 'utf8'));
    const map = {
      apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
      authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
      databaseURL: 'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
    };
    const src = cfg.firebaseConfig ?? cfg;
    for (const [k, v] of Object.entries(src)) {
      if (map[k]) process.stdout.write(map[k] + '=' + v + '\n');
    }
  ")
fi

if [[ ${#KEY_VALUE_PAIRS[@]} -eq 0 ]]; then
  echo "ERROR: No key=value pairs provided and no --firebase-config specified."
  exit 1
fi

# ── Update YAML in place ──────────────────────────────────────────────────────

echo "Updating $CONFIG_FILE..."

for pair in "${KEY_VALUE_PAIRS[@]}"; do
  KEY="${pair%%=*}"
  VALUE="${pair#*=}"

  # Update existing key or insert within the variables: block.
  # KEY and VALUE are passed via process.argv to avoid shell injection.
  action=$(node - "$CONFIG_FILE" "$KEY" "$VALUE" <<'NODE'
const fs = require('fs');
const [, , configFile, key, value] = process.argv;
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const content = fs.readFileSync(configFile, 'utf8');
const lines = content.split('\n');

const variablesStart = lines.findIndex(l => /^variables:\s*$/.test(l));
if (variablesStart === -1) {
  process.stderr.write(`ERROR: No variables: block found in ${configFile}\n`);
  process.exit(1);
}

let variablesEnd = lines.length;
for (let i = variablesStart + 1; i < lines.length; i++) {
  if (/^\S/.test(lines[i]) && lines[i].trim() !== '') { variablesEnd = i; break; }
}

const renderedLine = `  ${key}: ${JSON.stringify(value)}`;
const keyPat = new RegExp(`^  ${escapeRegex(key)}:.*$`);
let updated = false;
for (let i = variablesStart + 1; i < variablesEnd; i++) {
  if (keyPat.test(lines[i])) { lines[i] = renderedLine; updated = true; break; }
}
if (!updated) lines.splice(variablesEnd, 0, renderedLine);

let out = lines.join('\n');
if (content.endsWith('\n') && !out.endsWith('\n')) out += '\n';
fs.writeFileSync(configFile, out);
process.stdout.write(updated ? 'Updated' : 'Added');
NODE
  )
  echo "  $action $KEY"
done

# ── Validate ──────────────────────────────────────────────────────────────────

echo ""
echo "Validating against schema..."
node "$SCRIPT_DIR/validate-config.mjs" --env="$ENV_NAME"

echo ""
echo "YAML updated. Run 'cd terraform && terraform apply' to push to Vercel."
