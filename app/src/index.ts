import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig, parseListenAddress } from './config.ts';
import { cachedSecret, dynamoKeyLookup } from './deps.ts';
import { jsonLogger } from './logger.ts';

const config = loadConfig();
const app = createApp({
  config,
  keyLookup: dynamoKeyLookup(config.tableName),
  getUpstreamKey: cachedSecret(config.openrouterSecretId),
  log: jsonLogger,
});

const { host, port } = parseListenAddress(process.env.AWS_LAMBDA_HTTP_ENDPOINT);
serve({ fetch: app.fetch, hostname: host, port }, (info) => {
  jsonLogger({ level: 'info', msg: 'listening', host: info.address, port: info.port });
});
