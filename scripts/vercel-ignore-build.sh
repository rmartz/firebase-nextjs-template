#!/usr/bin/env bash
# Vercel "Ignored Build Step" — decides whether a preview deploy proceeds, to
# avoid spending the daily preview-deploy quota on PRs that don't need a preview.
#
# Per Vercel's convention: exit 1 → build (deploy), exit 0 → skip (cancel).
#
# Policy: build production always; for PR previews, build only when the PR title
# is a `feat:` or `fix:` (with optional scope / `!`) — those are the changes a
# reviewer is most likely to want a live preview for. Everything else (chore,
# docs, ci, test, refactor, …) skips the preview.
#
# The PR title is read from the public GitHub API using Vercel's git env vars —
# no token needed (this is a public repo). The check FAILS OPEN: if the title
# can't be read (rate limit, network, no PR context), it builds, so a needed
# preview is never wrongly skipped — the gate only ever skips when it has
# positively confirmed a non-feat/fix title.
#
# Wired via vercel.json's `ignoreCommand` ("bash scripts/vercel-ignore-build.sh"),
# which overrides the Project Settings "Ignored Build Step" — so the gate is
# version-controlled and active on merge, with no dashboard step. Vercel injects
# VERCEL_ENV and the VERCEL_GIT_* vars used below into this command automatically.

set -u

# Production deploys always build.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "Production deploy — building."
  exit 1
fi

pr="${VERCEL_GIT_PULL_REQUEST_ID:-}"
owner="${VERCEL_GIT_REPO_OWNER:-}"
slug="${VERCEL_GIT_REPO_SLUG:-}"

# No associated PR (e.g. a branch push with no open PR) — nothing to gate on.
if [ -z "$pr" ] || [ -z "$owner" ] || [ -z "$slug" ]; then
  echo "No PR context — building (nothing to gate on)."
  exit 1
fi

title="$(
  curl -sf "https://api.github.com/repos/${owner}/${slug}/pulls/${pr}" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).title||"")}catch{process.stdout.write("")}})' 2>/dev/null
)"

# Fail open: build when the title can't be determined.
if [ -z "$title" ]; then
  echo "Could not read PR #${pr} title — building (fail-open)."
  exit 1
fi

echo "PR #${pr} title: ${title}"

# Build only for feat:/fix: titles (optional (scope) and ! marker allowed).
if printf '%s' "$title" | grep -qE '^(feat|fix)(\([^)]*\))?!?:'; then
  echo "feat/fix PR — building preview."
  exit 1
fi

echo "Non-feat/fix PR — skipping preview to conserve Vercel quota."
exit 0
