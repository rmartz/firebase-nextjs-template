#!/usr/bin/env bash
# Rotates Firebase service account keys and Sentry auth tokens for one or both
# environments. Updates Vercel with the new values, waits for a healthy
# deployment, then decommissions the old credentials.
#
# Usage:
#   scripts/rotate-keys.sh --env=staging
#   scripts/rotate-keys.sh --env=production
#   scripts/rotate-keys.sh                    # rotates both environments
#   scripts/rotate-keys.sh --force-single     # allow single-environment repos
#
# All rotation credentials come from local user auth — nothing stored in Vercel:
#   Firebase:  gcloud auth login
#   Sentry:    sentry-cli login  (or SENTRY_AUTH_TOKEN in shell)
#   Vercel:    vercel login
#
# Requires: gcloud, sentry-cli, vercel, jq, node

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

# POSIX-compatible array population (mapfile requires Bash 4+, macOS ships Bash 3.2)
CONFIGURED_ENVS=()
while IFS= read -r line; do
  CONFIGURED_ENVS+=("$line")
done < <(grep "^  - " "$ENVIRONMENTS_FILE" | awk '{print $2}')

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

for tool in gcloud sentry-cli vercel jq node; do
  if ! command -v "$tool" &>/dev/null; then
    echo "ERROR: $tool not found."
    case "$tool" in
      gcloud)     echo "  Install: https://cloud.google.com/sdk/docs/install" ;;
      sentry-cli) echo "  Install: curl -sL https://sentry.io/get-cli/ | bash" ;;
      vercel)     echo "  Install: pnpm add -g vercel" ;;
      jq)         echo "  Install: brew install jq" ;;
    esac
    exit 1
  fi
done

if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
  echo "ERROR: No active gcloud account. Run: gcloud auth login"
  exit 1
fi

if ! vercel whoami &>/dev/null 2>&1; then
  echo "ERROR: Not authenticated with Vercel. Run: vercel login"
  exit 1
fi

# Sentry: accept either sentry-cli session or env var
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

echo "All prerequisites met."
echo ""

# ── Vercel helpers ────────────────────────────────────────────────────────────

# Read Vercel project ID and team ID from .vercel/project.json (set by vercel link)
VERCEL_PROJECT_JSON="$PROJECT_ROOT/.vercel/project.json"
if [[ ! -f "$VERCEL_PROJECT_JSON" ]]; then
  echo "ERROR: .vercel/project.json not found. Run 'vercel link' first."
  exit 1
fi
VERCEL_PROJECT_ID=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$VERCEL_PROJECT_JSON','utf8')).projectId)")
VERCEL_ORG_ID=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$VERCEL_PROJECT_JSON','utf8')).orgId ?? '')")
VERCEL_API_TOKEN=$(vercel whoami --token 2>/dev/null || true)

# Fall back to reading the token from ~/.local/share/com.vercel.cli/auth.json
if [[ -z "$VERCEL_API_TOKEN" ]]; then
  VERCEL_API_TOKEN=$(node -e "
    const f = require('os').homedir() + '/.local/share/com.vercel.cli/auth.json';
    try { process.stdout.write(JSON.parse(require('fs').readFileSync(f,'utf8')).token ?? ''); } catch {}
  " 2>/dev/null || true)
fi

if [[ -z "$VERCEL_API_TOKEN" ]]; then
  echo "ERROR: Could not read Vercel API token. Run: vercel login"
  exit 1
fi

# Upsert a single Vercel env var via the REST API (avoids CLI stdin quote corruption).
# Usage: vercel_env_upsert KEY VALUE VERCEL_ENV
vercel_env_upsert() {
  local key="$1" value="$2" vercel_env="$3"
  local team_param=""
  [[ -n "$VERCEL_ORG_ID" ]] && team_param="teamId=${VERCEL_ORG_ID}&"

  local payload
  payload=$(node -e "process.stdout.write(JSON.stringify({key:process.argv[1],value:process.argv[2],type:'encrypted',target:[process.argv[3]]}))" \
    "$key" "$value" "$vercel_env")

  local response
  response=$(curl -sf \
    -X POST \
    -H "Authorization: Bearer $VERCEL_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?${team_param}upsert=true")

  if [[ -z "$response" ]]; then
    echo "ERROR: Empty response from Vercel API when upserting $key"
    exit 1
  fi
}

# ── YAML value reader ─────────────────────────────────────────────────────────

# Read a value from deployment/{env}.yml stripping surrounding YAML quotes.
# Usage: read_yaml_value CONFIG_FILE KEY
read_yaml_value() {
  local config_file="$1" key="$2"
  node - "$config_file" "$key" <<'NODE'
const fs = require('fs');
const [,,configFile, key] = process.argv;
const lines = fs.readFileSync(configFile, 'utf8').split('\n');
for (const line of lines) {
  const m = line.match(/^\s+([^:]+):\s*(.*)/);
  if (m && m[1].trim() === key) {
    process.stdout.write(m[2].replace(/^["']|["']$/g, '').trim());
    process.exit(0);
  }
}
process.exit(0);
NODE
}

# ── Per-environment rotation ──────────────────────────────────────────────────

rotate_environment() {
  local env="$1"
  local config_file="$DEPLOYMENT_DIR/$env.yml"

  # Map env name to Vercel environment target
  local vercel_env
  case "$env" in
    preview|staging) vercel_env="preview" ;;
    production)      vercel_env="production" ;;
    *) echo "ERROR: Unknown environment: $env"; exit 1 ;;
  esac

  echo "══════════════════════════════════════════"
  echo " Rotating $env"
  echo "══════════════════════════════════════════"

  # Read project config using the robust YAML reader
  local project_id
  project_id=$(read_yaml_value "$config_file" "FIREBASE_PROJECT_ID")
  if [[ -z "$project_id" ]]; then
    echo "ERROR: FIREBASE_PROJECT_ID not set in $config_file"
    exit 1
  fi

  local sentry_org sentry_project
  sentry_org=$(read_yaml_value "$config_file" "SENTRY_ORG")
  sentry_project=$(read_yaml_value "$config_file" "SENTRY_PROJECT")

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

  # Capture the current key IDs before creating new ones
  echo "1. Capturing existing Firebase key IDs..."
  OLD_KEY_IDS=()
  while IFS= read -r line; do
    OLD_KEY_IDS+=("$line")
  done < <(gcloud iam service-accounts keys list \
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
  # Vercel requires literal \n in the private key value (not actual newlines)
  new_private_key=$(jq -r '.private_key' "$key_file" | awk '{printf "%s\\n", $0}' | sed 's/\\n$//')

  # Create new Sentry token
  echo "3. Creating new Sentry auth token..."
  local new_sentry_token=""
  if [[ -n "$sentry_org" && -n "$sentry_project" ]]; then
    new_sentry_token=$(curl -sf \
      -H "Authorization: Bearer $SENTRY_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"scopes\":[\"project:releases\",\"project:read\",\"org:read\"]}" \
      "https://sentry.io/api/0/api-tokens/" | jq -r '.token')
    if [[ -z "$new_sentry_token" || "$new_sentry_token" == "null" ]]; then
      echo "WARNING: Could not create Sentry token (check token scopes). Skipping Sentry rotation."
      new_sentry_token=""
    fi
  else
    echo "   (Sentry not configured for $env — skipping)"
  fi

  # Update Vercel via REST API (avoids CLI stdin quote corruption)
  echo "4. Updating Vercel ($vercel_env)..."
  vercel_env_upsert FIREBASE_CLIENT_EMAIL "$new_client_email" "$vercel_env"
  echo "   Updated FIREBASE_CLIENT_EMAIL"
  vercel_env_upsert FIREBASE_PRIVATE_KEY "$new_private_key" "$vercel_env"
  echo "   Updated FIREBASE_PRIVATE_KEY"

  if [[ -n "$new_sentry_token" ]]; then
    vercel_env_upsert SENTRY_AUTH_TOKEN "$new_sentry_token" "$vercel_env"
    echo "   Updated SENTRY_AUTH_TOKEN"
  fi

  # Trigger redeploy and wait
  echo "5. Triggering Vercel redeploy..."
  local deploy_url
  deploy_url=$(vercel deploy --target="$vercel_env" --yes 2>/dev/null | tail -1)
  echo "   Deployed: $deploy_url"

  echo "   Waiting for deployment to become healthy..."
  local attempts=0
  local max_attempts=30
  while [[ $attempts -lt $max_attempts ]]; do
    local state
    state=$(vercel inspect "$deploy_url" --json 2>/dev/null | jq -r '.readyState // "BUILDING"')
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
  for old_key_id in "${OLD_KEY_IDS[@]}"; do
    gcloud iam service-accounts keys delete "$old_key_id" \
      --iam-account="$sa_email" \
      --project="$project_id" \
      --quiet 2>/dev/null && echo "   Deleted Firebase key: $old_key_id" || true
  done

  # Sentry: automatic revocation is skipped because listing all account tokens and
  # excluding the new one would delete tokens belonging to other projects on the
  # same Sentry user. Revoke the old token manually in the Sentry UI once the
  # new deployment is confirmed healthy.
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
echo "Run 'pnpm env:pull' to refresh your local .env.local with the new staging credentials."
