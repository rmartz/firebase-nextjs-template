---
type: Script
title: update-config.sh
description: Updates public deployment config in deployment/{env}.yml, validates it against the schema, and optionally syncs to Vercel.
resource: scripts/update-config.sh
tags: [deployment, config, vercel, firebase]
---

# update-config.sh

Updates a public (non-secret) environment config file under `deployment/`, validates the result against [the deployment-config schema](../subsystems/deployment-config.md), and optionally pushes the values to Vercel.

## Usage

```bash
# Set one or more keys in deployment/preview.yml (YAML only)
scripts/update-config.sh --env=preview NEXT_PUBLIC_FEATURE_X=true

# Map a Firebase console config JSON into NEXT_PUBLIC_FIREBASE_* keys
scripts/update-config.sh --env=production --firebase-config=/path/to/config.json

# Update the YAML and immediately push to Vercel
scripts/update-config.sh --env=preview NEXT_PUBLIC_FEATURE_X=true --sync
```

## Flags

- `--env=<preview|production>` — **required.** Selects which `deployment/{env}.yml` to update.
- `KEY=value` — one or more public config pairs to set. Never pass secrets this way; they leak into shell history and `ps` output. Use `pnpm exec vercel env add` for secrets.
- `--firebase-config=<path>` — path to a Firebase console config file. Accepts both strict JSON and the JS object-literal snippet the console produces, and maps the recognized fields to `NEXT_PUBLIC_FIREBASE_*` keys automatically.
- `--sync` — after writing the YAML, run `pnpm exec sync-env --env=<env>` to push the values to Vercel. Without it, only the local YAML changes.

## Behavior

1. Validates every proposed key against `deployment/schema.yml` **before** writing, so a denied or unknown key leaves the working tree clean.
2. Updates each key in place within the `variables:` block (or inserts it if absent).
3. Re-validates the whole file via [validate-config.mjs](validate-config.md).
4. With `--sync`, hands off to the `sync-env` binary from the `vercel-deploy-scripts` package.

## Requires

- `node`

## Related

- [validate-config.mjs](validate-config.md) — the schema validator this script invokes.
- [Deployment config subsystem](../subsystems/deployment-config.md) — the overall config-and-secrets flow.
