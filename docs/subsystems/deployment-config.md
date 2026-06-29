---
type: Subsystem
title: Deployment config
description: How public env config is stored as committed YAML, validated against a schema, and synced to Vercel — and how secrets are kept out and rotated.
resource: deployment/
tags: [deployment, config, vercel, firebase, sentry, secrets]
---

# Deployment config

Public, non-secret environment configuration is committed to the repo as YAML under `deployment/` and pushed to Vercel from there. Secrets never live in these files — a schema rejects anything secret-like, and credentials are managed separately through the `envctl` CLI (in development).

## Files

- `deployment/{env}.yml` — the public config for one environment (`preview`, `production`). Keys live under a `variables:` block.
- `deployment/schema.yml` — the allow/deny rules. `allowed_patterns` (e.g. `NEXT_PUBLIC_*`), `allowed_keys` (explicit non-sensitive server keys), and `denied_patterns` (`*SECRET*`, `*_TOKEN*`, `*PRIVATE_KEY*`, etc.) that are always rejected.
- `deployment/environments.yml` — declares which environments are `active`, plus a `single_environment` flag for repos that intentionally use one.

## Flow

1. **Edit** a value with [update-config.sh](../scripts/update-config.md) — it pre-validates against the schema before writing, so a bad key never dirties the tree.
2. **Validate** with [validate-config.mjs](../scripts/validate-config.md) — run directly, via `pnpm run env:validate`, on every commit via `.husky/pre-commit`, and in CI (`.github/workflows/config-validate.yml`).
3. **Sync** to Vercel with the `envctl` CLI (in development), which upserts each variable atomically.

## Secrets

Secrets are deliberately outside this YAML. Pushing config to Vercel and rotating credentials (Firebase + Sentry) are handled by the `envctl` CLI (in development), kept separate from the committed YAML.

The schema's `denied_patterns` (the first line of defense in [validate-config.mjs](../scripts/validate-config.md)) keep secret-like keys out of the committed YAML entirely.

## Related

- [update-config.sh](../scripts/update-config.md)
- [validate-config.mjs](../scripts/validate-config.md)
