export interface Config {
  tableName: string;
  openrouterSecretId: string;
  model: string;
  maxBodyBytes: number;
  maxQuestions: number;
  upstreamTimeoutMs: number;
  upstreamUrl: string;
}

function intEnv(env: NodeJS.ProcessEnv, name: string, def: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`invalid ${name}`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    tableName: env.TABLE_NAME ?? '',
    openrouterSecretId: env.OPENROUTER_SECRET_ID ?? '',
    model: env.MODEL || 'typesafe/jev-1.13',
    maxBodyBytes: intEnv(env, 'MAX_BODY_BYTES', 65536),
    maxQuestions: intEnv(env, 'MAX_QUESTIONS', 20),
    upstreamTimeoutMs: intEnv(env, 'UPSTREAM_TIMEOUT_MS', 10000),
    upstreamUrl: 'https://openrouter.ai/api/alpha/decisions',
  };
}

/** AWS_LAMBDA_HTTP_ENDPOINT is `host:port` (also tolerates `[::1]:port`). Local fallback 127.0.0.1:8080. */
export function parseListenAddress(raw: string | undefined): { host: string; port: number } {
  if (!raw) return { host: '127.0.0.1', port: 8080 };
  const i = raw.lastIndexOf(':');
  if (i < 0) throw new Error('AWS_LAMBDA_HTTP_ENDPOINT must be host:port');
  const host = raw.slice(0, i).replace(/^\[|\]$/g, '');
  const port = Number(raw.slice(i + 1));
  if (!host || !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('AWS_LAMBDA_HTTP_ENDPOINT must be host:port');
  }
  return { host, port };
}
