# bootstrap/

One-time Terraform stack (local state, never committed) that creates what `infra/` and CI need:

- S3 state bucket `jev-decision-api-tfstate-168523833501-us-east-1` (versioning, SSE-KMS with a dedicated rotating key, public access block, TLS-only policy, noncurrent versions expire after 90d, `force_destroy = false`)
- GitHub OIDC provider (`create_oidc_provider`, default `true`; set `-var create_oidc_provider=false` if the account already has `token.actions.githubusercontent.com`, it is then looked up instead)
- Read-only role `jev-decision-api-plan`, trusted only for `sub = repo:miqui/jev-decision-api-lambda-web:pull_request`, `aud = sts.amazonaws.com`. Its policy is `iam/plan-role-policy.json` (source of truth, loaded via `file()`). It cannot write to the state bucket (CI plans use `-lock=false`) and cannot read secret values.

Region: us-east-1 only. Account guard: `allowed_account_ids`.

## One-time apply (Miguel, local)

Supply AWS credentials through 1Password without writing them to disk, e.g. an env file containing only `op://` references (the vault/item names are yours; none are stored in this repo):

```sh
cd bootstrap
op run --env-file=../aws.op.env -- terraform init
op run --env-file=../aws.op.env -- terraform plan -out=tfplan
op run --env-file=../aws.op.env -- terraform apply tfplan
```

`terraform.tfstate` stays local and is gitignored; back it up somewhere private (it is the only record of these resources).

Then set the repo secret and the backend config for `infra/`:

```sh
gh secret set AWS_PLAN_ROLE_ARN --repo miqui/jev-decision-api-lambda-web --body "$(terraform output -raw plan_role_arn)"
terraform output kms_key_arn   # put into infra/backend.hcl (see infra/backend.hcl.example)
```

## Policy changes lag

The role policy in AWS only changes when bootstrap is re-applied. After merging changes under `iam/`, either re-apply, or push a new default version:

```sh
aws iam create-policy-version \
  --policy-arn <plan_policy_arn output> \
  --policy-document file://iam/plan-role-policy.json \
  --set-as-default
```

(IAM keeps at most 5 versions; delete an old non-default one first if needed.)

## Run manually

Commands executed while authoring (no AWS credentials were available locally, so no `plan`/`apply` was run):

```sh
cd bootstrap
terraform fmt -check -recursive      # exit 0, no output
terraform init -backend=false        # Success; lock file .terraform.lock.hcl written
terraform validate                   # Success! The configuration is valid.
python3 -m json.tool iam/plan-role-policy.json   # valid JSON
```
