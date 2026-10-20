variable "account_id" {
  description = "AWS account ID (guard against applying to the wrong account)."
  type        = string
  default     = "168523833501"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) allowed to assume the plan role."
  type        = string
  default     = "miqui/jev-decision-api-lambda-web"
}

variable "create_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set false if token.actions.githubusercontent.com already exists in the account (it is then looked up via data source)."
  type        = bool
  default     = true
}
