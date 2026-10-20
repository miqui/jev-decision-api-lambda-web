# bootstrap/

One-time Terraform stack (local state, never committed) that creates what `infra/` and CI need:

- S3 state bucket `jev-decision-api-tfstate-<account_id>-us-east-1` (versioning, SSE-KMS with a dedicated rotating key, public access block, TLS-only policy, noncurrent versions expire after 90d, `force_destroy = false`)
- GitHub OIDC provider (`create_oidc_provider`, default `true`; set `-var create_oidc_provider=false` if the account already has `token.actions.githubusercontent.com`, it is then looked up instead)
- Read-only role `jev-decision-api-plan`, trusted only for `sub = repo:miqui/jev-decision-api-lambda-web:pull_request`, `aud = sts.amazonaws.com`. Its policy is generated from the bootstrap resources in Terraform. It cannot write to the state bucket (CI plans use `-lock=false`) and cannot read secret values.

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

## Policy changes

The role policy in AWS only changes when bootstrap is re-applied:

```sh
terraform apply
```

## Run manually

Commands executed while authoring (no AWS credentials were available locally, so no `plan`/`apply` was run):

```sh
cd bootstrap
terraform fmt -check -recursive      # exit 0, no output
terraform init -backend=false        # Success; lock file .terraform.lock.hcl written
terraform validate                   # Success! The configuration is valid.
```
