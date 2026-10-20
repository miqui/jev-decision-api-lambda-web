import { vi } from 'vitest';
import { createApp } from '../src/app.ts';
import { sha256Hex } from '../src/auth.ts';
import { loadConfig } from '../src/config.ts';

export const GOOD_KEY = 'good-key-VALUE-0123456789';
export const REVOKED_KEY = 'revoked-key-VALUE-9876543210';
export const UPSTREAM_KEY = 'sk-or-UPSTREAM-SECRET-abcdef';

const table = new Map([
  [sha256Hex(GOOD_KEY), true],
  [sha256Hex(REVOKED_KEY), false],
]);

export function setup(opts: { fetchFn?: typeof fetch; env?: NodeJS.ProcessEnv } = {}) {
  const logs: string[] = [];
  const fetchFn = opts.fetchFn ?? vi.fn();
  const lookup = vi.fn(async (h: string) => {
    const active = table.get(h);
    return active === undefined ? null : { keyHash: h, active };
  });
  const app = createApp({
    config: loadConfig({ ...opts.env }),
    keyLookup: lookup,
    getUpstreamKey: async () => UPSTREAM_KEY,
    fetchFn: fetchFn as typeof fetch,
    log: (f) => logs.push(JSON.stringify(f)),
  });
  return { app, logs, fetchFn: fetchFn as ReturnType<typeof vi.fn>, lookup };
}

export const post = (
  app: ReturnType<typeof setup>['app'],
  body: unknown,
  headers: Record<string, string> = {},
) =>
  app.request('/v1/decisions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': GOOD_KEY, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

export const validBody = {
  state: { note: 'The user asked for a refund after 45 days.' },
  questions: {
    eligible: { type: 'noul', instructions: 'Is the refund eligible?' },
    tier: { type: 'choice', instructions: 'Which tier?', criteria: { a: 'low', b: 'high' } },
    risk: { type: 'score', instructions: 'Risk?', criteria: ['none', 'some', 'lots'] },
  },
};

export const upstreamAnswers = {
  answers: {
    eligible: { type: 'noul', probabilities: { true: 0.2, false: 0.8 } },
    tier: { type: 'choice', probabilities: { a: 0.7, b: 0.3 } },
    risk: { type: 'score', score: 1.4 },
  },
};

export const okFetch = () =>
  vi.fn(async () => new Response(JSON.stringify(upstreamAnswers), { status: 200 }));
