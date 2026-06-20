#!/usr/bin/env bash
# Enforce the LOC hard cap on TypeScript files — single implementation shared
# by the pre-commit hook (--staged) and the CI workflow (--base <ref>) so the
# rule cannot drift between the two.
#
# Usage:
#   scripts/check-file-length.sh --staged        # pre-commit: staged files vs HEAD
#   scripts/check-file-length.sh --base <ref>    # CI: changed files vs <ref>
#
# Thresholds from CLAUDE.md — 2× the recommended maximum:
#   Source files: recommended max ~200 lines → hard cap at 400
#   Test files:   recommended max ~300 lines → hard cap at 600

SOURCE_LIMIT=400
TEST_LIMIT=600

mode=""
base_ref=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --staged) mode="staged"; shift ;;
    --base) mode="base"; base_ref="$2"; shift 2 ;;
    *) echo "Usage: $0 --staged | --base <ref>" >&2; exit 1 ;;
  esac
done

if [ -z "$mode" ]; then
  echo "Usage: $0 --staged | --base <ref>" >&2
  exit 1
fi

failed=0

if [ "$mode" = "staged" ]; then
  changed_files() { git diff --cached --name-only --diff-filter=ACMR; }
else
  changed_files() { git diff --name-only "$base_ref" HEAD; }
fi

while IFS= read -r file; do
  [ -n "$file" ] || continue

  # Skip deleted files (base mode)
  [ -f "$file" ] || continue

  # Only TypeScript source files
  case "$file" in
    *.ts|*.tsx) ;;
    *) continue ;;
  esac

  # Determine limit
  case "$file" in
    *.spec.ts|*.spec.tsx|*-tests/*.ts|*-tests/*.tsx)
      limit=$TEST_LIMIT
      kind="test"
      ;;
    *)
      limit=$SOURCE_LIMIT
      kind="source"
      ;;
  esac

  # Count lines: staged blob in pre-commit mode, working-tree file in CI mode
  if [ "$mode" = "staged" ]; then
    lines=$(git show ":$file" 2>/dev/null | wc -l | tr -d ' ')
  else
    lines=$(wc -l < "$file" | tr -d ' ')
  fi

  if [ "$lines" -ge "$limit" ]; then
    if [ "${GITHUB_ACTIONS}" = "true" ]; then
      echo "::error file=$file,title=File too long::$file — $lines lines ($kind limit: $limit)"
    else
      echo "error: $file — $lines lines ($kind limit: $limit)" >&2
    fi
    failed=1
  fi
done < <(changed_files)

if [ "$failed" -ne 0 ]; then
  echo "" >&2
  echo "One or more files exceed the maximum allowed line count." >&2
  echo "  Source files: recommended max ~200 lines, hard cap at ${SOURCE_LIMIT}+" >&2
  echo "  Test files:   recommended max ~300 lines, hard cap at ${TEST_LIMIT}+" >&2
  echo "Split large files by logical concern before committing." >&2
  exit 1
fi
