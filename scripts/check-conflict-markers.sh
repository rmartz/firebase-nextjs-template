#!/usr/bin/env bash
# Block commits that introduce merge-conflict markers. Shared by the Husky hook
# (human commits) and claude/hooks/pre-commit (agent commits in worktrees) via
# --staged, mirroring the shared-script pattern of check-file-length.sh.
#
# Detection: a file is flagged only when it contains an unambiguous *angle*
# marker — a line starting with seven "<" or seven ">" (<<<<<<< HEAD,
# >>>>>>> branch). These never occur in normal source or Markdown. The
# separator (=======) and diff3-base (|||||||) lines are reported too, but only
# in a file that already has an angle marker — so a Markdown setext underline or
# "=======" divider is never a false positive.
#
# Usage:
#   scripts/check-conflict-markers.sh --staged   # scan staged blobs (pre-commit)
#
# Bypass: `git commit --no-verify` skips the hook (git-native); setting
# ALLOW_CONFLICT_MARKERS=1 also makes --staged pass, for the rare case where a
# marker-like line must be committed intentionally.

mode=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --staged) mode="staged"; shift ;;
    *) echo "Usage: $0 --staged" >&2; exit 1 ;;
  esac
done

if [ "$mode" != "staged" ]; then
  echo "Usage: $0 --staged" >&2
  exit 1
fi

if [ -n "${ALLOW_CONFLICT_MARKERS:-}" ]; then
  exit 0
fi

angle_re='^(<<<<<<<|>>>>>>>)([[:space:]]|$)'
mid_re='^(=======|\|\|\|\|\|\|\|)([[:space:]]|$)'

failed=0

while IFS= read -r file; do
  [ -n "$file" ] || continue

  # Staged blob content; skip files that can't be read (deleted, binary error).
  content="$(git show ":$file" 2>/dev/null)" || continue

  # Full-triple rule: only scan further when an angle marker is present.
  if printf '%s\n' "$content" | grep -qaE "$angle_re"; then
    if [ "$failed" -eq 0 ]; then
      echo "error: merge-conflict markers found in staged content:" >&2
    fi
    while IFS= read -r hit; do
      echo "  $file:$hit" >&2
    done < <(printf '%s\n' "$content" | grep -naE "$angle_re|$mid_re")
    failed=1
  fi
done < <(git diff --cached --name-only --diff-filter=ACMR)

if [ "$failed" -ne 0 ]; then
  echo "" >&2
  echo "Resolve the conflict, or bypass intentionally with \`git commit --no-verify\` (or ALLOW_CONFLICT_MARKERS=1)." >&2
  exit 1
fi
