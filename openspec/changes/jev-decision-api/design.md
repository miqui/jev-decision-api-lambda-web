## Context

See proposal.md. Constraints: Lambda Web Functions support only `nodejs24.x`; the app must listen on `AWS_LAMBDA_HTTP_ENDPOINT` with `index.js` at zip root; AWS provider has no Web Function resources yet (issue #50429, PR #50452); account 168523833501, us-east-1 only.

## Architecture

![Architecture](../../../docs/architecture.png)
*Rendered from docs/architecture.drawio — open in draw.io to edit.*

## Goals / Non-Goals

- Goals: minimal, reviewable reference; plan-only CI; least-privilege IAM.
- Non-Goals: apply in CI, rate limiting/metering, multimodal and danger-zone headers, multi-region, load tests.

## Decisions

1. **State**: S3 backend, `use_lockfile = true` (no DynamoDB lock table), key `jev-decision-api/<env>/terraform.tfstate`. Alt: Terraform Cloud (extra vendor), DynamoDB lock (deprecated path). Bootstrap uses local state, applied once by Miguel, gitignored.
2. **CI plan role**: read-only AWS + read state; plans run `-lock=false`. Alt: write role with lock (rejected: needs bucket write from PR context).
3. **Web Function outside Terraform**: standalone script now; swap to `aws_lambdaweb_*` resources when provider releases them. Alt: wait (blocks project), unreleased provider branch (unsafe baseline).
4. **Two-stage apply**: stage 1 base resources; run deploy script; stage 2 passes `web_function_endpoint_host` and creates CloudFront + resource policy pinned to the distribution ARN. CI plans stage 2 with a labelled placeholder host.
5. **OAC specifics**: endpoint `IamAuth`; origin request policy `AllViewerExceptHostHeader`; custom `x-api-key` header (not `Authorization`) forwarded; caching disabled for POST; signing behavior `always-amz-auth`; no Lambda@Edge. Body is unsigned (UNSIGNED-PAYLOAD), protected by TLS only.
6. **Auth**: SHA-256 of random high-entropy key, DynamoDB table `pk=key_hash`, attrs `active`, `label`, `created_at`; `timingSafeEqual`; uniform 401. Key issuance via a documented local CLI snippet, not an API route.
7. **Upstream**: plain `fetch` to `/api/alpha/decisions` (chat SDKs do not apply). Model pinned `typesafe/jev-1.13` via env var. Request cap below the documented context (TypeSafe docs say 64k per request, OpenRouter lists 262K); cap configurable.
8. **Secrets**: Terraform creates the secret container only; value set out of band so it never enters state. Function reads at init and caches.
9. **Policy**: Conftest/OPA Rego on plan JSON (blocking; `opa test` for rules) plus Checkov on HCL (non-blocking v1, justified skips). Rules: no IAM wildcards on exec role, table PITR+encryption, state bucket versioning/KMS/public-block, OAC on origin, us-east-1 only.
10. **Fork PRs**: `pull_request` only (never `pull_request_target`); OIDC trust pinned to this repo's pull_request context; plan job guarded by head-repo check; a gate job reports for forks; verify repo setting "send write tokens to fork PRs" is off and outside-contributor approval is required.

## Risks / Trade-offs

- Web Function drift (outside state) -> README caveat, script is idempotent, swap-in task when provider lands.
- Unsigned POST body -> TLS in transit; app-level validation; documented.
- Spend abuse -> body/question caps, per-key revoke; metering listed as follow-up.
- CI role policy lags repo JSON -> documented `create-policy-version` step.
- Checkov noise -> non-blocking, triage before promotion.
- Deploy script runs with local creds -> minimal documented IAM policy, shellcheck in CI, never run in CI.

## Migration Plan

1. Miguel applies bootstrap/, sets repo secret `AWS_PLAN_ROLE_ARN`. 2. Apply infra stage 1. 3. Set secret value, mint a key. 4. Run deploy script. 5. Apply stage 2. Rollback: destroy stage 2, delete Web Function via script `--destroy`, `terraform destroy` stage 1.

## Open Questions

- Exact `aws lambda-web` flags and runtime config JSON; confirm against CLI 2.36.42 during implementation.
- Confirm required `x-api-key` forwarding via CloudFront origin request policy.
