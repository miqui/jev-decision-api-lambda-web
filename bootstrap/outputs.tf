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
  description = "Use with aws iam create-policy-version when iam/plan-role-policy.json changes."
  value       = aws_iam_policy.plan.arn
}
