output "state_bucket_name" {
  value = aws_s3_bucket.state.bucket
}

output "plan_role_arn" {
  value = aws_iam_role.plan.arn
}

output "kms_key_arn" {
  value = aws_kms_key.state.arn
}

output "plan_policy_arn" {
  description = "ARN of the Terraform-managed plan role policy."
  value       = aws_iam_policy.plan.arn
}
