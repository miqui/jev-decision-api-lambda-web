## ADDED Requirements

### Requirement: Remote state
Terraform state for `infra/` SHALL live in a versioned, KMS-encrypted, public-access-blocked S3 bucket with native lockfile locking; the bootstrap stack SHALL create that bucket and use local state that is never committed.

#### Scenario: State not in repo
- **WHEN** the secrets/state guard runs
- **THEN** any committed `*.tfstate` fails the check

### Requirement: Region and baseline resources
All resources SHALL be in us-east-1 and include a DynamoDB key table (encryption, PITR), a Secrets Manager secret container whose value is not in state, an execution role scoped to that table and secret, and CloudWatch alarms.

#### Scenario: Wildcard IAM
- **WHEN** a plan contains an IAM statement with `*` action or resource for the execution role
- **THEN** the policy gate fails

### Requirement: Origin lock-down
CloudFront with OAC SHALL be the only entry; the endpoint auth type SHALL be `IamAuth` and the resource policy SHALL allow only this distribution.

#### Scenario: Direct endpoint call
- **WHEN** a client calls the Web Function endpoint without a CloudFront-signed request
- **THEN** the call is rejected (403)

### Requirement: Standalone deploy script
A script outside Terraform state SHALL create/update the Web Function, revision and endpoint (`nodejs24.x`, entry `index.js`) and print the endpoint host for stage-2 apply; it SHALL NOT run in CI.

#### Scenario: Two-stage apply
- **WHEN** stage 1 is applied, the script run, then stage 2 applied with `web_function_endpoint_host`
- **THEN** requests via CloudFront reach the function and `/healthz` returns 200
