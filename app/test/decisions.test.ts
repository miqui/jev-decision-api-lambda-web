import { describe, expect, it, vi } from 'vitest';
import { okFetch, post, setup, UPSTREAM_KEY, upstreamAnswers, validBody } from './helpers.ts';

describe('GET /healthz', () => {
  it('returns 200 unauthenticated without upstream or db calls', async () => {
    const { app, fetchFn, lookup } = setup();
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('POST /v1/decisions', () => {
  it('forwards noul/choice/score and passes answers through', async () => {
    const fetchFn = okFetch();
    const { app } = setup({ fetchFn });
    const res = await post(app, validBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(upstreamAnswers);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${UPSTREAM_KEY}`);
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'typesafe/jev-1.13', ...validBody });
  });

  it('honours MODEL env override and string state', async () => {
    const fetchFn = okFetch();
    const { app } = setup({ fetchFn, env: { MODEL: 'x/y' } });
    const res = await post(app, { state: 'text', questions: validBody.questions });
    expect(res.status).toBe(200);
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string).model).toBe('x/y');
  });

  it('400 on unsupported type without calling upstream', async () => {
    const fetchFn = okFetch();
    const { app } = setup({ fetchFn });
    const res = await post(app, {
      state: 'a',
      questions: { q: { type: 'rank', instructions: 'x' } },
    });
    expect(res.status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('400 on invalid JSON and bad shapes', async () => {
    const { app } = setup();
    expect((await post(app, '{nope')).status).toBe(400);
    expect((await post(app, { state: 5, questions: validBody.questions })).status).toBe(400);
  });

  it('413 when Content-Length exceeds cap', async () => {
    const fetchFn = okFetch();
    const { app } = setup({ fetchFn, env: { MAX_BODY_BYTES: '100' } });
    const res = await post(app, validBody, { 'content-length': '101' });
    expect(res.status).toBe(413);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('413 when actual body exceeds cap despite small/absent Content-Length', async () => {
    const fetchFn = okFetch();
    const { app } = setup({ fetchFn, env: { MAX_BODY_BYTES: '100' } });
    const res = await post(app, { ...validBody, pad: 'x'.repeat(500) }, { 'content-length': '10' });
    expect(res.status).toBe(413);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('400 for more than MAX_QUESTIONS and for zero questions', async () => {
    const fetchFn = okFetch();
    const { app } = setup({ fetchFn, env: { MAX_QUESTIONS: '2' } });
    expect((await post(app, validBody)).status).toBe(400);
    expect((await post(app, { state: 'a', questions: {} })).status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('502 on upstream non-2xx with no leakage', async () => {
    const fetchFn = vi.fn(
      async () => new Response('SECRET-UPSTREAM-BODY stack at x.js:1', { status: 500 }),
    );
    const { app } = setup({ fetchFn });
    const res = await post(app, validBody);
    const text = await res.text();
    expect(res.status).toBe(502);
    const json = JSON.parse(text);
    expect(json.error).toBe('upstream_error');
    expect(json.request_id).toBe(res.headers.get('x-request-id'));
    expect(text).not.toContain('SECRET-UPSTREAM-BODY');
    expect(text).not.toContain(UPSTREAM_KEY);
  });

  it('502 on network error with no leakage', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error(`connect ECONNREFUSED ${UPSTREAM_KEY}`);
    });
    const { app, logs } = setup({ fetchFn });
    const res = await post(app, validBody);
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).not.toContain('ECONNREFUSED');
    expect(logs.join('\n')).not.toContain(UPSTREAM_KEY);
  });

  it('504 on timeout', async () => {
    const fetchFn = vi.fn(
      (_u: unknown, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init?.signal?.addEventListener('abort', () =>
            rej(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const { app } = setup({
      fetchFn: fetchFn as unknown as typeof fetch,
      env: { UPSTREAM_TIMEOUT_MS: '20' },
    });
    const res = await post(app, validBody);
    expect(res.status).toBe(504);
    const json = await res.json();
    expect(json.error).toBe('upstream_timeout');
    expect(json.request_id).toBeTruthy();
  });

  it('502 when upstream 200 lacks answers', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 200 }));
    const { app } = setup({ fetchFn });
    expect((await post(app, validBody)).status).toBe(502);
  });

  it('404 JSON for unknown routes (authenticated)', async () => {
    const { app } = setup();
    const res = await app.request('/nope', { headers: { 'x-api-key': 'k' } });
    expect([401, 404]).toContain(res.status);
    const ok = await app.request('/nope', {
      headers: { 'x-api-key': (await import('./helpers.ts')).GOOD_KEY },
    });
    expect(ok.status).toBe(404);
    expect((await ok.json()).error).toBe('not_found');
  });
});
