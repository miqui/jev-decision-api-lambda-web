import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { verifyApiKey, type KeyLookup } from './auth.ts';
import type { Config } from './config.ts';
import type { Logger } from './logger.ts';
import { decisionRequest } from './schema.ts';

export interface Deps {
  config: Config;
  keyLookup: KeyLookup;
  getUpstreamKey: () => Promise<string>;
  fetchFn?: typeof fetch;
  log: Logger;
}

type Env = { Variables: { requestId: string } };

/** Reads the request body, aborting once more than `max` bytes have arrived. Returns null if too big. */
async function readCapped(req: Request, max: number): Promise<string | null> {
  const declared = req.headers.get('content-length');
  if (declared !== null && Number(declared) > max) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createApp(deps: Deps): Hono<Env> {
  const { config, log } = deps;
  const doFetch = deps.fetchFn ?? fetch;
  const app = new Hono<Env>();

  app.use('*', async (c, next) => {
    const requestId = randomUUID();
    c.set('requestId', requestId);
    c.header('x-request-id', requestId);
    const start = Date.now();
    await next();
    log({
      level: 'info',
      msg: 'request',
      request_id: requestId,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      duration_ms: Date.now() - start,
    });
  });

  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  app.use('*', async (c, next) => {
    let ok: boolean;
    try {
      ok = await verifyApiKey(c.req.header('x-api-key'), deps.keyLookup);
    } catch (e) {
      log({
        level: 'error',
        msg: 'auth_lookup_failed',
        request_id: c.get('requestId'),
        error: errName(e),
      });
      return c.json({ error: 'internal_error', request_id: c.get('requestId') }, 500);
    }
    if (!ok) return c.json({ error: 'unauthorized' }, 401);
    await next();
  });

  app.post('/v1/decisions', async (c) => {
    const requestId = c.get('requestId');
    const raw = await readCapped(c.req.raw, config.maxBodyBytes);
    if (raw === null) return c.json({ error: 'payload_too_large', request_id: requestId }, 413);

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return c.json({ error: 'invalid_request', request_id: requestId }, 400);
    }
    const parsed = decisionRequest.safeParse(json);
    if (!parsed.success) {
      // Zod issue paths/messages echo no secrets; return paths only.
      const issues = parsed.error.issues.slice(0, 10).map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return c.json({ error: 'invalid_request', issues, request_id: requestId }, 400);
    }
    const count = Object.keys(parsed.data.questions).length;
    if (count === 0 || count > config.maxQuestions) {
      return c.json(
        {
          error: 'invalid_request',
          message: `questions must contain 1-${config.maxQuestions} items`,
          request_id: requestId,
        },
        400,
      );
    }

    let upstreamKey: string;
    try {
      upstreamKey = await deps.getUpstreamKey();
    } catch (e) {
      log({ level: 'error', msg: 'secret_read_failed', request_id: requestId, error: errName(e) });
      return c.json({ error: 'internal_error', request_id: requestId }, 500);
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.upstreamTimeoutMs);
    try {
      const res = await doFetch(config.upstreamUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstreamKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          state: parsed.data.state,
          questions: parsed.data.questions,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        log({
          level: 'warn',
          msg: 'upstream_status',
          request_id: requestId,
          upstream_status: res.status,
        });
        await res.body?.cancel().catch(() => undefined);
        return c.json({ error: 'upstream_error', request_id: requestId }, 502);
      }
      const body = (await res.json()) as { answers?: unknown } | null;
      if (!body || typeof body !== 'object' || body.answers === undefined) {
        log({ level: 'warn', msg: 'upstream_bad_shape', request_id: requestId });
        return c.json({ error: 'upstream_error', request_id: requestId }, 502);
      }
      return c.json({ answers: body.answers }, 200);
    } catch (e) {
      if (ctrl.signal.aborted) {
        log({ level: 'warn', msg: 'upstream_timeout', request_id: requestId });
        return c.json({ error: 'upstream_timeout', request_id: requestId }, 504);
      }
      log({ level: 'warn', msg: 'upstream_failure', request_id: requestId, error: errName(e) });
      return c.json({ error: 'upstream_error', request_id: requestId }, 502);
    } finally {
      clearTimeout(timer);
    }
  });

  app.notFound((c) => c.json({ error: 'not_found', request_id: c.get('requestId') }, 404));
  app.onError((e, c) => {
    log({ level: 'error', msg: 'unhandled', request_id: c.get('requestId'), error: errName(e) });
    return c.json({ error: 'internal_error', request_id: c.get('requestId') }, 500);
  });
  return app;
}

function errName(e: unknown): string {
  return e instanceof Error ? e.name : 'unknown';
}
