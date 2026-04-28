variable "vercel_project_id" {
  description = "Vercel project ID. Found in Project Settings → General, or in .vercel/project.json after running 'vercel link'."
  type        = string
}

variable "vercel_team_id" {
  description = "Vercel team ID. Found in Team Settings → General. Leave null for personal accounts."
  type        = string
  default     = null
}

variable "vercel_api_token" {
  description = "Vercel API token. Generate at https://vercel.com/account/tokens (Full Account scope). Set via VERCEL_API_TOKEN environment variable — do not store in tfvars files."
  type        = string
  sensitive   = true
  default     = null
}
