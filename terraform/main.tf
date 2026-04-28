terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 2.0"
    }
  }

  # Configure a backend for shared state before using this in a team.
  # Local state is gitignored by default — it is machine-local and cannot
  # be used for CI plan/apply or multi-operator workflows.
  #
  # Example — Terraform Cloud:
  # backend "remote" {
  #   organization = "your-org"
  #   workspaces { name = "firebase-nextjs-template" }
  # }
  #
  # Example — GCS:
  # backend "gcs" {
  #   bucket = "my-tf-state"
  #   prefix = "firebase-nextjs-template"
  # }
}

provider "vercel" {
  # Set VERCEL_API_TOKEN in your environment before running terraform commands.
  # Generate a token at https://vercel.com/account/tokens (Full Account scope).
  # For CI, store it as a repository secret named VERCEL_API_TOKEN.
  api_token = var.vercel_api_token

  team = var.vercel_team_id != null ? var.vercel_team_id : null
}

# ── Environment → Vercel target mapping ──────────────────────────────────────
# Maps deployment environment names to Vercel environment targets.
# "staging" is the legacy name for the preview environment.

locals {
  vercel_target_map = {
    preview    = "preview"
    staging    = "preview"
    production = "production"
  }

  # Read the active environments from environments.yml
  environments = yamldecode(file("${path.module}/../deployment/environments.yml")).environments

  # For each environment, read its YAML and build a flat map of resource keys.
  # Resource key format: "{env_name}/{VAR_NAME}" — unique across all environments.
  # Empty-string values are skipped: they mean "not yet configured" in the template.
  env_vars = merge([
    for env in local.environments : {
      for key, value in yamldecode(file("${path.module}/../deployment/${env}.yml")).variables
      : "${env}/${key}" => {
        key    = key
        value  = tostring(value)
        target = local.vercel_target_map[env]
      }
      if value != null && tostring(value) != ""
    }
  ]...)
}

resource "vercel_project_environment_variable" "config" {
  for_each = local.env_vars

  project_id = var.vercel_project_id
  team_id    = var.vercel_team_id

  key     = each.value.key
  value   = each.value.value
  targets = [each.value.target]
  type    = "plain"
}
