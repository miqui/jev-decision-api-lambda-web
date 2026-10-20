## 1. Repo and governance (E)

- [ ] 1.1 Create public repo via git-workflow.sh only; add .gitignore (tfstate, .terraform, node_modules), LICENSE, betterleaks config
- [ ] 1.2 Protect main (PR + 1 approval; required checks lint-app, test-app, tf-static, secrets, policy-test, plan); verify fork-PR token settings

## 2. Hono app (B)

- [ ] 2.1 Scaffold TypeScript Hono app, index.js entry listening on AWS_LAMBDA_HTTP_ENDPOINT, esbuild zip build
- [ ] 2.2 Implement /healthz and POST /v1/decisions with zod validation, body/question caps
- [ ] 2.3 Implement x-api-key auth (SHA-256, DynamoDB lookup, timingSafeEqual, uniform 401, no key logging)
- [ ] 2.4 Implement OpenRouter client (fetch, typesafe/jev-1.13 env-configurable, Secrets Manager read+cache, error mapping 502/504)
- [ ] 2.5 vitest unit + contract tests with mocked upstream and DynamoDB; zip layout test

## 3. Terraform bootstrap (A)

- [ ] 3.1 bootstrap/: state bucket (versioning, KMS, public block, TLS-only), OIDC provider, read-only plan role pinned to repo pull_request sub
- [ ] 3.2 Role policy JSON in repo; document create-policy-version step; terraform fmt/validate locally

## 4. Terraform infra and policy (C)

- [ ] 4.1 infra/: S3 backend (use_lockfile), code bucket, DynamoDB key table (SSE, PITR), Secrets Manager container, execution role (scoped), alarms
- [ ] 4.2 Stage 2: CloudFront + OAC (AllViewerExceptHostHeader, x-api-key forwarded, POST uncached, always-amz-auth), web_function_endpoint_host variable, resource policy pinned to distribution ARN
- [ ] 4.3 Rego policies + *_test.rego (IAM wildcards, PITR/SSE, state bucket, OAC, us-east-1)
- [ ] 4.4 scripts/deploy-web-function.sh (aws lambda-web deploy, nodejs24.x, idempotent, --destroy, prints endpoint host), shellcheck clean, minimal IAM policy doc; confirm flags against CLI 2.36.42

## 5. CI (D)

- [ ] 5.1 Workflows: lint-app, test-app, tf-static, checkov (soft_fail, SARIF), secrets, policy-test, plan (OIDC, -lock=false, conftest), fork gate job
- [ ] 5.2 Pin tool versions with checksums; Dependabot for npm and actions

## 6. Docs (E)

- [ ] 6.1 README: architecture, state handling, two-stage apply, Production checklist, Run manually (only executed commands), known gaps
- [ ] 6.2 Key minting snippet, provider swap-in note (PR #50452)
