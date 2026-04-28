#!/usr/bin/env bash
# Generates .env.local in the project root by pulling from Vercel's stored
# environment variables for the preview environment.
#
# Usage: scripts/generate-local-env.sh
#
# Requires: pnpm (vercel as devDependency), authenticated via `pnpm exec vercel login`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Prerequisites ─────────────────────────────────────────────────────────────

if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found. Install from https://pnpm.io/installation"
  exit 1
fi

if ! pnpm exec vercel whoami &>/dev/null 2>&1; then
  echo "ERROR: Not authenticated with Vercel."
  echo "Run: pnpm exec vercel login"
  exit 1
fi

# ── Pull ──────────────────────────────────────────────────────────────────────

OUTPUT="$PROJECT_ROOT/.env.local"

echo "Pulling preview environment variables from Vercel..."
pnpm exec vercel env pull "$OUTPUT" --environment=preview --yes

echo ""
echo "Written to .env.local (gitignored — do not commit)."
echo "Re-run this script after key rotation to refresh your local credentials."
