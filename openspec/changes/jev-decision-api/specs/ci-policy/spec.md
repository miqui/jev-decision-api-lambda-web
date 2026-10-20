## ADDED Requirements

### Requirement: CI on every pull request
Workflows SHALL run on every pull request and push to main, with least-privilege permissions and SHA-pinned actions.

#### Scenario: PR opened
- **WHEN** a PR is opened
- **THEN** lint-app, test-app, tf-static, checkov, secrets, policy-test and plan run

### Requirement: Plan-only
CI SHALL run `terraform plan` through a read-only OIDC role with `-lock=false` and SHALL NOT apply; fork PRs SHALL receive no AWS credentials.

#### Scenario: Fork PR
- **WHEN** a PR originates from a fork
- **THEN** plan is skipped, keyless checks run, and a gate job reports "plan not run"

### Requirement: Policy gates
Rego policies SHALL be evaluated with OPA/Conftest against the plan JSON and unit-tested with `opa test`; Checkov SHALL scan the HCL non-blocking in v1.

#### Scenario: Policy violation
- **WHEN** a plan violates a Rego deny rule
- **THEN** the plan job fails

### Requirement: Branch protection
main SHALL require a PR, one approval, and the checks lint-app, test-app, tf-static, secrets, policy-test and plan.

#### Scenario: Merge attempt
- **WHEN** a required check fails
- **THEN** merge is blocked
