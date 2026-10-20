import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/auth.ts';
import { GOOD_KEY, okFetch, post, REVOKED_KEY, setup, UPSTREAM_KEY, validBody } from './helpers.ts';

describe('api key auth', () => {
  it('missing, unknown and revoked keys give identical 401 bodies', async () => {
    const fetchFn = okFetch();
    const { app } = setup({ fetchFn });
    const bodies: string[] = [];
    for (const headers of [
      { 'x-api-key': '' },
      { 'x-api-key': 'unknown-key' },
      { 'x-api-key': REVOKED_KEY },
    ]) {
      const res = await post(app, validBody, headers);
      expect(res.status).toBe(401);
      bodies.push(await res.text());
    }
    const noHeader = await app.request('/v1/decisions', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });
    expect(noHeader.status).toBe(401);
    bodies.push(await noHeader.text());
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0] as string)).toEqual({ error: 'unauthorized' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does a lookup on the miss path too and fails closed on db error', async () => {
    const { app, lookup } = setup();
    await app.request('/v1/decisions', { method: 'POST' });
    expect(lookup).toHaveBeenCalledTimes(1);
    const failing = (await import('../src/app.ts')).createApp({
      config: (await import('../src/config.ts')).loadConfig({}),
      keyLookup: async () => {
        throw new Error('ddb down');
      },
      getUpstreamKey: async () => UPSTREAM_KEY,
      log: () => undefined,
    });
    const res = await failing.request('/v1/decisions', {
      method: 'POST',
      headers: { 'x-api-key': GOOD_KEY },
    });
    expect(res.status).toBe(500);
  });

  it('looks up the lowercase hex sha256 of the raw key', async () => {
    const { app, lookup } = setup();
    await post(app, validBody);
    expect(lookup).toHaveBeenCalledWith(sha256Hex(GOOD_KEY));
    expect(sha256Hex(GOOD_KEY)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('log hygiene', () => {
  it('no log line contains the api keys, their hashes, or the upstream key', async () => {
    const { app, logs } = setup({ fetchFn: okFetch() });
    await post(app, validBody);
    await post(app, validBody, { 'x-api-key': REVOKED_KEY });
    await post(app, validBody, { 'x-api-key': 'unknown-key' });
    await app.request('/healthz');
    expect(logs.length).toBeGreaterThan(0);
    const all = logs.join('\n');
    for (const secret of [GOOD_KEY, REVOKED_KEY, 'unknown-key', UPSTREAM_KEY]) {
      expect(all).not.toContain(secret);
      expect(all).not.toContain(sha256Hex(secret));
    }
  });
});
