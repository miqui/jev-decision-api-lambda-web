import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import AdmZip from 'adm-zip';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => resolve(p));
    });
  });

describe('function.zip', () => {
  it('has index.js at root and serves /healthz on AWS_LAMBDA_HTTP_ENDPOINT', async () => {
    execFileSync('npm', ['run', 'package'], { stdio: 'pipe' });
    const entries = new AdmZip('dist/function.zip').getEntries().map((e) => e.entryName);
    expect(entries).toContain('index.js');

    const dir = mkdtempSync(join(tmpdir(), 'fn-'));
    new AdmZip('dist/function.zip').extractAllTo(dir, true);
    const port = await freePort();
    const child = spawn(process.execPath, [join(dir, 'index.js')], {
      env: { PATH: process.env.PATH ?? '', AWS_LAMBDA_HTTP_ENDPOINT: `127.0.0.1:${port}` },
      stdio: 'ignore',
    });
    try {
      let res: Response | undefined;
      for (let i = 0; i < 50 && !res; i++) {
        res = await fetch(`http://127.0.0.1:${port}/healthz`).catch(() => undefined);
        if (!res) await new Promise((r) => setTimeout(r, 100));
      }
      expect(res?.status).toBe(200);
      expect(await res?.json()).toEqual({ status: 'ok' });
    } finally {
      child.kill();
    }
  });
});
