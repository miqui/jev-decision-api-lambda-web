## ADDED Requirements

### Requirement: API key authentication
Every route except `/healthz` SHALL require a valid key in the `x-api-key` header, verified against stored SHA-256 hashes; plaintext keys SHALL NOT be stored.

#### Scenario: Valid key
- **WHEN** the header hash matches an active record
- **THEN** the request proceeds

#### Scenario: Missing, unknown or revoked key
- **WHEN** the header is absent, unknown, or its record is inactive
- **THEN** the service responds 401 with an identical body in all three cases

### Requirement: Secret hygiene
The service SHALL NOT log the `x-api-key` value or the upstream API key, and comparison SHALL be constant-time.

#### Scenario: Log inspection
- **WHEN** requests with valid and invalid keys are processed
- **THEN** no log line contains either key value
