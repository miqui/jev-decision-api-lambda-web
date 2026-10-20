#!/usr/bin/env node
// Mints an API key locally. Makes NO AWS call. The key is printed once; only its hash is stored.
// Usage: node scripts/mint-api-key.mjs [label] > put-item.json   (key goes to stderr)
import { createHash, randomBytes } from 'node:crypto';

const label = process.argv[2] ?? 'unnamed';
const key = randomBytes(32).toString('base64url');
const keyHash = createHash('sha256').update(key).digest('hex');
const item = {
  key_hash: { S: keyHash },
  active: { BOOL: true },
  label: { S: label },
  created_at: { S: new Date().toISOString() },
};
process.stderr.write(`API key (shown once, store it securely): ${key}\n`);
process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
