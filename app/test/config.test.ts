import { describe, expect, it } from 'vitest';
import { loadConfig, parseListenAddress } from '../src/config.ts';

describe('config', () => {
  it('defaults', () => {
    const c = loadConfig({});
    expect(c).toMatchObject({
      model: 'typesafe/jev-1.13',
      maxBodyBytes: 65536,
      maxQuestions: 20,
      upstreamTimeoutMs: 10000,
    });
  });
  it('parses host:port with local fallback', () => {
    expect(parseListenAddress(undefined)).toEqual({ host: '127.0.0.1', port: 8080 });
    expect(parseListenAddress('0.0.0.0:9000')).toEqual({ host: '0.0.0.0', port: 9000 });
    expect(parseListenAddress('[::1]:9000')).toEqual({ host: '::1', port: 9000 });
    expect(() => parseListenAddress('nonsense')).toThrow();
  });
});
