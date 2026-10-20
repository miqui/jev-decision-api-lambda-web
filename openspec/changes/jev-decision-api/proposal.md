## Why

Expose Jev (TypeSafe System One decision model) as a small authenticated HTTP API on AWS Lambda Web Functions, as a reference for running a standard Hono server serverlessly with Terraform-managed infrastructure and plan-only CI. Web Functions are new (Oct 2026), so a vetted baseline is useful now.

## What Changes

- Hono (TypeScript, `nodejs24.x`) service exposing `POST /v1/decisions` and `GET /healthz`; calls OpenRouter `POST /api/alpha/decisions` with pinned model `typesafe/jev-1.13` (configurable).
- API-key auth via `x-api-key` header; SHA-256 hashes stored in DynamoDB; constant-time compare; uniform 401.
- Input validation (schema, body size cap, question-count cap) to bound OpenRouter spend.
- Terraform (us-east-1 only): `bootstrap/` (local state; S3 state bucket with native locking via `use_lockfile`, GitHub OIDC provider, read-only plan role) and `infra/` (S3 code bucket, execution role, DynamoDB key table, Secrets Manager secret container, CloudFront + OAC, alarms).
- Standalone `scripts/deploy-web-function.sh` wrapping `aws lambda-web deploy`, because the AWS provider has no Web Function resources yet (issue #50429, PR #50452 open). Two-stage apply: stage 1 base resources, deploy script, stage 2 CloudFront with `web_function_endpoint_host`.
- Policy gates: OPA/Conftest Rego rules on the plan JSON (blocking) with `opa test`; Checkov on HCL (non-blocking in v1).
- CI on every PR: lint-app, test-app, tf-static, checkov, secrets (betterleaks), policy-test, plan (OIDC, read-only, `-lock=false`, no apply), plus a fork-PR gate job.
- README with Production checklist and "Run manually" (only commands actually executed).

## Capabilities

### New Capabilities
- `decision-api`: HTTP contract for `/v1/decisions` and `/healthz`, validation, Jev upstream mapping, error model.
- `api-key-auth`: `x-api-key` verification against hashed keys in DynamoDB.
- `infrastructure`: Terraform bootstrap/infra stacks, state handling, CloudFront OAC, IAM least privilege, two-stage apply, deploy script.
- `ci-policy`: CI jobs, required checks, Rego and Checkov gates, fork-PR handling.

### Modified Capabilities
- None.

## Impact

- New public repo `miqui/jev-decision-api-lambda-web`; main protected (PR + approval; required checks = CI job names except checkov).
- AWS account 168523833501, us-east-1: new S3, DynamoDB, Secrets Manager, CloudFront, IAM, OIDC resources; recurring OpenRouter cost per input token.
- Known gap: Web Function/revision/endpoint live outside Terraform state until provider support lands.
- Out of scope v1: per-key rate limiting/metering, multimodal/danger-zone features, multi-region, k6 load tests.
