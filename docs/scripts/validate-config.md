---
type: Script
title: validate-config.mjs
description: Validates each active deployment config file against deployment/schema.yml, rejecting secret-like or unlisted keys.
resource: scripts/validate-config.mjs
tags: [deployment, config, validation, ci]
---

# validate-config.mjs

Validates the public config files under `deployment/` against `deployment/schema.yml`. Exits non-zero if any key is secret-like or not explicitly permitted, which is what makes it safe to commit the config to the repo.

## Usage

```bash
# Validate every active environment (the default)
node scripts/validate-config.mjs
pnpm run env:validate

# Validate a single environment
node scripts/validate-config.mjs --env=preview
```

It also runs on every commit via `.husky/pre-commit` and in CI via `.github/workflows/config-validate.yml`.

## How keys are checked

For each environment in `deployment/environments.yml`, it loads `deployment/{env}.yml` and checks every key in the `variables:` block against the schema, in order:

1. `denied_patterns` — matched keys are rejected immediately, even if they also match an allowed pattern (belt-and-suspenders against secret naming conventions like `*SECRET*`, `*_TOKEN*`, `*PRIVATE_KEY*`).
2. `allowed_patterns` — a key matching one of these (e.g. `NEXT_PUBLIC_*`) is accepted.
3. `allowed_keys` — non-sensitive server-side keys (slugs, identifiers) listed explicitly.

A key matching neither an allowed pattern nor an allowed key is rejected.

## Environment guard

If `environments.yml` lists fewer than two environments and `single_environment` is not `true`, the script errors — this catches a repo that expects separate preview/production configs but is silently operating with one.

## Requires

- `node`

## Related

- [update-config.sh](update-config.md) — invokes this validator after editing a config file.
- [Deployment config subsystem](../subsystems/deployment-config.md) — the schema and environment-declaration files this validates against.
