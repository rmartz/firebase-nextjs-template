#!/usr/bin/env bash
# Rotates Firebase service account keys and Sentry auth tokens for one or both
# environments. Updates Vercel with the new values, waits for a healthy
# deployment, then decommissions the old credentials.
#
# Usage:
#   scripts/rotate-keys.sh --env=preview
#   scripts/rotate-keys.sh --env=production
#   scripts/rotate-keys.sh                    # rotates both environments
#   scripts/rotate-keys.sh --force-single     # allow single-environment repos
#
# All rotation credentials come from local user auth — nothing stored in Vercel:
#   Firebase:  gcloud auth login
#   Sentry:    sentry-cli login  (or SENTRY_AUTH_TOKEN in shell)
#   Vercel:    pnpm exec vercel login
#
# Requires: gcloud, jq, curl
# vercel is a project devDependency — use via pnpm exec vercel
# sentry-cli is required only when SENTRY_ORG is configured in a target environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment"

# ── Argument parsing ──────────────────────────────────────────────────────────

ENV_TARGET=""
FORCE_SINGLE=false

for arg in "$@"; do
  case "$arg" in
    --env=*) ENV_TARGET="${arg#--env=}" ;;
    --force-single) FORCE_SINGLE=true ;;
    *) echo "ERROR: Unknown argument: $arg"; exit 1 ;;
  esac
done

# ── Environment guard ─────────────────────────────────────────────────────────

ENVIRONMENTS_FILE="$DEPLOYMENT_DIR/environments.yml"
if [[ ! -f "$ENVIRONMENTS_FILE" ]]; then
  echo "ERROR: deployment/environments.yml not found."
  exit 1
fi

SINGLE_ENV=$(grep "^single_environment:" "$ENVIRONMENTS_FILE" | awk '{print $2}' || echo "false")
# while IFS= read -r is used instead of mapfile -t for Bash 3.x compatibility (macOS default shell).
CONFIGURED_ENVS=()
while IFS= read -r line; do CONFIGURED_ENVS+=("$line"); done < <(grep "^  - " "$ENVIRONMENTS_FILE" | awk '{print $2}')

if [[ "${#CONFIGURED_ENVS[@]}" -lt 2 && "$SINGLE_ENV" != "true" && "$FORCE_SINGLE" != "true" ]]; then
  echo "ERROR: Only one environment is configured but single_environment is not true."
  echo "Set single_environment: true in deployment/environments.yml, or pass --force-single."
  exit 1
fi

if [[ -n "$ENV_TARGET" ]]; then
  ENVS_TO_ROTATE=("$ENV_TARGET")
else
  ENVS_TO_ROTATE=("${CONFIGURED_ENVS[@]}")
fi

for env in "${ENVS_TO_ROTATE[@]}"; do
  if [[ ! -f "$DEPLOYMENT_DIR/$env.yml" ]]; then
    echo "ERROR: deployment/$env.yml not found."
    exit 1
  fi
done

# ── Prerequisites ─────────────────────────────────────────────────────────────

echo "Checking prerequisites..."

VERCEL="pnpm exec vercel"

# Determine whether any target environment has Sentry configured
SENTRY_NEEDED=false
for env in "${ENVS_TO_ROTATE[@]}"; do
  sentry_org=$(grep "^  SENTRY_ORG:" "$DEPLOYMENT_DIR/$env.yml" | sed 's/.*: *//' | tr -d "\"' ")
  if [[ -n "$sentry_org" ]]; then
    SENTRY_NEEDED=true
    break
  fi
done

for tool in curl gcloud jq; do
  if ! command -v "$tool" &>/dev/null; then
    echo "ERROR: $tool not found."
    case "$tool" in
      curl)   echo "  Install: brew install curl" ;;
      gcloud) echo "  Install: https://cloud.google.com/sdk/docs/install" ;;
      jq)     echo "  Install: brew install jq" ;;
    esac
    exit 1
  fi
done

if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
  echo "ERROR: No active gcloud account. Run: gcloud auth login"
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found. Install it from https://pnpm.io/installation"
  exit 1
fi
if ! pnpm exec vercel --version &>/dev/null 2>&1; then
  echo "ERROR: vercel not found in node_modules. Run: pnpm install"
  exit 1
fi
if ! $VERCEL whoami &>/dev/null 2>&1; then
  echo "ERROR: Not authenticated with Vercel. Run: pnpm exec vercel login"
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/.vercel/project.json" ]]; then
  echo "ERROR: .vercel/project.json not found. Run: pnpm exec vercel link"
  exit 1
fi

# Sentry credentials — only required when SENTRY_ORG is set in a target environment
SENTRY_TOKEN=""
if [[ "$SENTRY_NEEDED" == "true" ]]; then
  if ! command -v sentry-cli &>/dev/null; then
    echo "ERROR: sentry-cli not found (required — SENTRY_ORG is configured)."
    echo "  Install: curl -sL https://sentry.io/get-cli/ | bash"
    exit 1
  fi
  SENTRY_TOKEN="${SENTRY_AUTH_TOKEN:-}"
  if [[ -z "$SENTRY_TOKEN" ]]; then
    SENTRY_TOKEN=$(grep "^token" ~/.sentryclirc 2>/dev/null | awk -F= '{print $2}' | tr -d ' ' || true)
  fi
  if [[ -z "$SENTRY_TOKEN" ]]; then
    echo "ERROR: No Sentry credentials found."
    echo "  Run: sentry-cli login"
    echo "  Or:  export SENTRY_AUTH_TOKEN=<your-personal-token>"
    exit 1
  fi
fi

echo "All prerequisites met."
echo ""

# ── Shared-project guard ─────────────────────────────────────────────────────
# If two environments share a FIREBASE_PROJECT_ID, rotating both in one run
# will delete the first environment's new key during the second rotation
# (it appears "old" relative to that run's OLD_KEY_IDS snapshot).
# Require separate --env= invocations when a project ID is shared.
# Uses parallel indexed arrays (not declare -A) for Bash 3.x compatibility.

SEEN_PROJECT_ID_KEYS=()
SEEN_PROJECT_ID_ENVS=()
for env in "${ENVS_TO_ROTATE[@]}"; do
  config_file="$DEPLOYMENT_DIR/$env.yml"
  project_id=$(grep "^  FIREBASE_PROJECT_ID:" "$config_file" | sed 's/.*: *//' | tr -d "\"' ")
  if [[ -z "$project_id" ]]; then
    continue  # Missing project ID is caught with a clearer error inside rotate_environment()
  fi
  for i in "${!SEEN_PROJECT_ID_KEYS[@]}"; do
    if [[ "${SEEN_PROJECT_ID_KEYS[$i]}" == "$project_id" ]]; then
      echo "ERROR: FIREBASE_PROJECT_ID \"$project_id\" is shared between environments: ${SEEN_PROJECT_ID_ENVS[$i]} and $env."
      echo "Rotating both in one run would delete the first environment's new key during"
      echo "the second rotation. Rotate each environment separately instead:"
      echo "  scripts/rotate-keys.sh --env=${SEEN_PROJECT_ID_ENVS[$i]}"
      echo "  scripts/rotate-keys.sh --env=$env"
      exit 1
    fi
  done
  SEEN_PROJECT_ID_KEYS+=("$project_id")
  SEEN_PROJECT_ID_ENVS+=("$env")
done

# ── Vercel env upsert helper ──────────────────────────────────────────────────
# Uses the Vercel REST API with upsert=true so the operation is atomic — no
# window where the old value is deleted but the new value is not yet set.

vercel_env_upsert() {
  local key="$1" value="$2" target="$3"
  node - "$PROJECT_ROOT" "$key" "$value" "$target" <<'NODE'
const fs = require('fs');
const os = require('os');
const https = require('https');
const [,, projectRoot, key, value, target] = process.argv;

function readVercelToken() {
  const candidates = [
    os.homedir() + '/Library/Application Support/com.vercel.cli/auth.json',
    os.homedir() + '/.local/share/com.vercel.cli/auth.json',
    os.homedir() + '/.config/com.vercel.cli/auth.json',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const a = JSON.parse(fs.readFileSync(p, 'utf8'));
      const t = typeof a.token === 'object' ? Object.values(a.token)[0] : a.token;
      if (t) return t;
    }
  }
  return null;
}

const token = readVercelToken();
if (!token) {
  process.stderr.write('ERROR: Could not read Vercel auth token. Run: pnpm exec vercel login\n');
  process.exit(1);
}

let projectId, orgId;
try {
  ({ projectId, orgId } = JSON.parse(fs.readFileSync(projectRoot + '/.vercel/project.json', 'utf8')));
} catch (e) {
  process.stderr.write('ERROR: Could not read .vercel/project.json: ' + e.message + '\n');
  process.exit(1);
}

const body = JSON.stringify({ key, value, target: [target], type: 'encrypted' });
const req = https.request(
  {
    hostname: 'api.vercel.com',
    path: `/v10/projects/${projectId}/env?teamId=${orgId}&upsert=true`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  },
  res => {
    let d = '';
    res.on('data', c => (d += c));
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        process.exit(0);
      }
      process.stderr.write(`ERROR: Vercel API HTTP ${res.statusCode}: ${d}\n`);
      process.exit(1);
    });
  },
);
req.on('error', e => { process.stderr.write('ERROR: ' + e.message + '\n'); process.exit(1); });
req.write(body);
req.end();
NODE
}

# ── Per-environment rotation ──────────────────────────────────────────────────

rotate_environment() {
  local env="$1"
  local config_file="$DEPLOYMENT_DIR/$env.yml"

  # Map env name to Vercel environment target
  local vercel_env
  case "$env" in
    preview)    vercel_env="preview" ;;
    production) vercel_env="production" ;;
    *) echo "ERROR: Unknown environment: $env"; exit 1 ;;
  esac

  echo "══════════════════════════════════════════"
  echo " Rotating $env"
  echo "══════════════════════════════════════════"

  # Read project config.
  # sed handles both quoted ("value") and unquoted (value) YAML values.
  local project_id
  project_id=$(grep "^  FIREBASE_PROJECT_ID:" "$config_file" | sed 's/.*: *//' | tr -d "\"' ")
  if [[ -z "$project_id" ]]; then
    echo "ERROR: FIREBASE_PROJECT_ID is empty or not set in $config_file"
    echo "  Run: scripts/update-config.sh --env=$env --firebase-config=/path/to/config.json"
    exit 1
  fi

  local sentry_org sentry_project
  sentry_org=$(grep "^  SENTRY_ORG:" "$config_file" | sed 's/.*: *//' | tr -d "\"' ")
  sentry_project=$(grep "^  SENTRY_PROJECT:" "$config_file" | sed 's/.*: *//' | tr -d "\"' ")

  # Resolve service account email
  local sa_email
  sa_email=$(gcloud iam service-accounts list \
    --project="$project_id" \
    --filter="email:firebase-adminsdk" \
    --format="value(email)" 2>/dev/null | head -1)
  if [[ -z "$sa_email" ]]; then
    echo "ERROR: Could not resolve Firebase service account email for project $project_id"
    exit 1
  fi

  # Capture the current key IDs before creating new ones.
  echo "1. Capturing existing Firebase key IDs..."
  OLD_KEY_IDS=()
  while IFS= read -r line; do OLD_KEY_IDS+=("$line"); done < <(gcloud iam service-accounts keys list \
    --iam-account="$sa_email" \
    --project="$project_id" \
    --managed-by=user \
    --format="value(name.basename())" 2>/dev/null)

  # Create new Firebase key
  echo "2. Creating new Firebase service account key..."
  local key_file
  key_file=$(mktemp)
  trap 'rm -f "$key_file"' EXIT
  gcloud iam service-accounts keys create "$key_file" \
    --iam-account="$sa_email" \
    --project="$project_id"

  local new_client_email new_private_key
  new_client_email=$(jq -r '.client_email' "$key_file")
  # Vercel requires literal \n in the private key value
  new_private_key=$(jq -r '.private_key' "$key_file" | awk '{printf "%s\\n", $0}' | sed 's/\\n$//')

  # Create new Sentry token
  echo "3. Creating new Sentry auth token..."
  local new_sentry_token=""
  if [[ -n "$sentry_org" && -n "$sentry_project" ]]; then
    new_sentry_token=$(curl -sf \
      -H "Authorization: Bearer $SENTRY_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"scopes\":[\"project:releases\",\"project:read\",\"org:read\"]}" \
      "https://sentry.io/api/0/api-tokens/" | jq -r '.token' || true)
    if [[ -z "$new_sentry_token" || "$new_sentry_token" == "null" ]]; then
      echo "WARNING: Could not create Sentry token (HTTP/network/API failure, or insufficient token scopes). Skipping Sentry rotation."
      new_sentry_token=""
    fi
  else
    echo "   (Sentry not configured for $env — skipping)"
  fi

  # Update Vercel via atomic REST API upsert.
  # Using upsert avoids the delete-then-add window where a deploy could start
  # between the two steps and read a missing variable.
  echo "4. Updating Vercel ($vercel_env)..."
  vercel_env_upsert FIREBASE_CLIENT_EMAIL "$new_client_email" "$vercel_env"
  echo "   Set FIREBASE_CLIENT_EMAIL"
  vercel_env_upsert FIREBASE_PRIVATE_KEY "$new_private_key" "$vercel_env"
  echo "   Set FIREBASE_PRIVATE_KEY"

  if [[ -n "$new_sentry_token" ]]; then
    vercel_env_upsert SENTRY_AUTH_TOKEN "$new_sentry_token" "$vercel_env"
    echo "   Set SENTRY_AUTH_TOKEN"
  fi

  # Trigger redeploy and wait
  echo "5. Triggering Vercel redeploy..."
  local deploy_url
  deploy_url=$($VERCEL deploy --target="$vercel_env" --yes 2>/dev/null | tail -1)
  echo "   Deployed: $deploy_url"

  echo "   Waiting for deployment to become healthy..."
  local attempts=0
  local max_attempts=30
  while [[ $attempts -lt $max_attempts ]]; do
    local state
    state=$($VERCEL inspect "$deploy_url" --json 2>/dev/null | jq -r '.readyState // "BUILDING"')
    if [[ "$state" == "READY" ]]; then
      echo "   Deployment healthy."
      break
    elif [[ "$state" == "ERROR" || "$state" == "CANCELED" ]]; then
      echo "ERROR: Deployment failed with state: $state"
      echo "Old credentials are still active. Investigate before decommissioning."
      exit 1
    fi
    attempts=$((attempts + 1))
    echo "   State: $state — waiting 10s ($attempts/$max_attempts)..."
    sleep 10
  done

  if [[ $attempts -ge $max_attempts ]]; then
    echo "ERROR: Deployment did not become healthy within $(( max_attempts * 10 ))s."
    echo "Old credentials are still active. Check Vercel dashboard before proceeding."
    exit 1
  fi

  # Decommission old credentials (only after healthy deployment confirmed)
  echo "6. Decommissioning old credentials..."
  if [[ ${#OLD_KEY_IDS[@]} -eq 0 ]]; then
    echo "   No pre-existing user-managed keys to decommission."
  else
    for old_key_id in "${OLD_KEY_IDS[@]}"; do
      gcloud iam service-accounts keys delete "$old_key_id" \
        --iam-account="$sa_email" \
        --project="$project_id" \
        --quiet 2>/dev/null && echo "   Deleted Firebase key: $old_key_id" || true
    done
  fi

  # Sentry token revocation is intentionally manual. Automatic revocation would
  # require listing all tokens on the Sentry account — which would include tokens
  # belonging to other projects. Revoking by exclusion risks deleting unrelated
  # tokens. The Sentry API does not provide a way to look up the previous token
  # value that was stored in Vercel to revoke it specifically.
  if [[ -n "$new_sentry_token" ]]; then
    echo "   Sentry token updated. Manually revoke the previous token for this"
    echo "   project/environment in the Sentry UI: https://sentry.io/settings/account/api/auth-tokens/"
  fi

  # Clean up key file
  rm -f "$key_file"
  trap - EXIT

  echo ""
  echo "$env rotation complete."
  echo ""
}

# ── Run ───────────────────────────────────────────────────────────────────────

for env in "${ENVS_TO_ROTATE[@]}"; do
  rotate_environment "$env"
done

echo "All rotations complete."
echo "Run 'pnpm env:pull' to refresh your local .env.local with the new preview credentials."
