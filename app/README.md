# app — Hono decision API

Hono + `@hono/node-server`, TypeScript strict, ESM. Runs as a plain HTTP server on AWS Lambda Web Functions (`nodejs24.x`); no adapters.

## Runtime contract

- Build output: `dist/index.js` (single esbuild bundle, no `node_modules` needed). `npm run package` zips it to `dist/function.zip` with `index.js` at the zip root.
- Listen address: env `AWS_LAMBDA_HTTP_ENDPOINT` in `host:port` format (per the AWS Web Functions runtime docs; `[::1]:port` also accepted). Unset (local dev) falls back to `127.0.0.1:8080`.

## Environment variables

- `TABLE_NAME` — DynamoDB key table (pk `key_hash` = lowercase hex SHA-256 of the raw key; attrs `active` BOOL, `label`, `created_at`).
- `OPENROUTER_SECRET_ID` — Secrets Manager secret id holding the OpenRouter key as a plain string; read once at first use, cached.
- `MODEL` — default `typesafe/jev-1.13`.
- `MAX_BODY_BYTES` — default 65536.
- `MAX_QUESTIONS` — default 20.
- `UPSTREAM_TIMEOUT_MS` — default 10000.
- `AWS_REGION` — standard AWS SDK region (us-east-1).

## Endpoints

- `GET /healthz` → 200 `{"status":"ok"}`; unauthenticated, no upstream calls.
- `POST /v1/decisions` (header `x-api-key`) body `{state, questions}` → 200 `{answers}`; 400 invalid/unsupported type/too many or zero questions; 401 `{"error":"unauthorized"}` (identical for missing/unknown/revoked); 413 oversize; 502 `upstream_error`; 504 `upstream_timeout`. Every response has an `x-request-id` header; error bodies include `request_id`. Upstream bodies, keys and stack traces are never returned or logged.

## Run locally with mocks

The tests inject a fake DynamoDB lookup and a mocked `fetch` (see `test/helpers.ts`), so everything is offline: `npm test`. To exercise the real bundle only, `/healthz` needs no AWS access.

## Mint an API key

`node scripts/mint-api-key.mjs [label]` makes no AWS call. It prints the key once on stderr and a DynamoDB `put-item` item (hash only) on stdout:

```
node scripts/mint-api-key.mjs my-client > item.json
aws dynamodb put-item --table-name <TABLE_NAME> --item file://item.json
```

Revoke by setting `active` to `false`.

## Run manually

Commands actually executed (Node v22.22.2 locally; Lambda uses Node 24):

```
npm ci                 # found 0 vulnerabilities
npm run lint           # eslint + prettier --check: All matched files use Prettier code style!
npm run typecheck      # tsc --noEmit, no errors
npm test               # Test Files 4 passed (4), Tests 20 passed (20)
npm run package        # built dist/index.js / wrote dist/function.zip
unzip -l dist/function.zip
#   2183224  10-20-2026 14:28   index.js
#   1 file
node scripts/mint-api-key.mjs demo   # printed key (stderr) + item with key_hash/active/label/created_at
```
