## ADDED Requirements

### Requirement: Decision endpoint
The service SHALL expose `POST /v1/decisions` accepting JSON `{state, questions}` and returning the typed `answers` produced by the Jev model `typesafe/jev-1.13` (model ID configurable).

#### Scenario: Valid request
- **WHEN** an authenticated client posts a valid `state` and `questions` (types `noul`, `choice`, `score`)
- **THEN** the service responds 200 with `answers` keyed by question name, each carrying its `type` and the model's probabilities/score

#### Scenario: Unsupported question type
- **WHEN** a question has a type other than `noul`, `choice` or `score`
- **THEN** the service responds 400 without calling the upstream

### Requirement: Input bounds
The service SHALL reject oversized requests to bound upstream spend.

#### Scenario: Body too large
- **WHEN** the request body exceeds the configured byte cap
- **THEN** the service responds 413

#### Scenario: Too many questions
- **WHEN** the number of questions exceeds the configured cap
- **THEN** the service responds 400

### Requirement: Health endpoint
The service SHALL expose unauthenticated `GET /healthz` returning 200 without calling the upstream.

#### Scenario: Health check
- **WHEN** a client calls `GET /healthz`
- **THEN** the response is 200 and contains no secrets or upstream data

### Requirement: Upstream error model
The service SHALL map upstream failures to stable errors and SHALL NOT expose upstream bodies, keys or stack traces.

#### Scenario: Upstream failure
- **WHEN** OpenRouter returns an error or times out
- **THEN** the service responds 502 (or 504 on timeout) with a generic JSON error and a request id
