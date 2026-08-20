import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  formatSessionPreflightFailure,
  runSessionPreflight,
  runSessionPreflightCli,
  sanitizeSessionPreflightText,
} from '../scripts/session-preflight.ts';

const root = resolve(import.meta.dir, '..');
const VALID_URL = 'https://example.upstash.io';
const VALID_TOKEN = 'example-upstash-token';
const validEnv = (overrides = {}) => ({
  UPSTASH_REDIS_REST_URL: VALID_URL,
  UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
  ...overrides,
});

const captureIO = () => {
  const stdout = [];
  const stderr = [];
  return {
    stdout: { write(chunk) { stdout.push(String(chunk)); return true; } },
    stderr: { write(chunk) { stderr.push(String(chunk)); return true; } },
    success: () => stdout.join(''),
    failure: () => stderr.join(''),
  };
};

const createMemoryRedis = ({
  ping = 'PONG',
  stored,
  ttl = 59,
  failOn,
} = {}) => {
  const calls = [];
  const values = new Map();
  const redis = {
    async ping() {
      calls.push({ method: 'ping' });
      if (failOn === 'ping') throw new Error(`authorization: Bearer ${VALID_TOKEN} url=${VALID_URL}`);
      return ping;
    },
    async set(key, value, options) {
      calls.push({ method: 'set', key, value, options });
      if (failOn === 'set') throw new Error('set failed');
      values.set(key, value);
    },
    async get(key) {
      calls.push({ method: 'get', key });
      if (failOn === 'get') throw new Error('get failed');
      if (stored !== undefined) return stored;
      return values.get(key) ?? null;
    },
    async ttl(key) {
      calls.push({ method: 'ttl', key });
      if (failOn === 'ttl') throw new Error('ttl failed');
      return ttl;
    },
    async del(key) {
      calls.push({ method: 'del', key });
      if (failOn === 'del') throw new Error(`del failed ${VALID_TOKEN}`);
      values.delete(key);
    },
  };
  return { redis, calls, values };
};

describe('preflight de sesiones Upstash', () => {
  test('el parser del preflight es testeable sin red', async () => {
    const io = captureIO();
    const code = await runSessionPreflightCli({}, io);
    expect(code).toBe(1);
    expect(io.failure()).toContain('Session preflight failed');
    expect(io.failure()).toContain('must be configured together');
    expect(io.success()).toBe('');
  });

  test('PING, SET, GET, TTL y DELETE usan una clave efímera propia', async () => {
    const { redis, calls } = createMemoryRedis();
    const io = captureIO();
    const code = await runSessionPreflightCli(validEnv(), {
      ...io,
      redis,
      randomUUID: () => '11111111-1111-1111-1111-111111111111',
    });
    expect(code).toBe(0);
    expect(io.success()).toBe([
      'Session preflight passed',
      'Upstash connectivity: OK',
      'Read/write: OK',
      'TTL: OK',
      'Cleanup: OK',
      '',
    ].join('\n'));
    expect(io.failure()).toBe('');
    expect(calls.map((call) => call.method)).toEqual(['ping', 'set', 'get', 'ttl', 'del']);
    expect(calls.find((call) => call.method === 'set')).toMatchObject({
      key: 'kingbelt-session-preflight:11111111-1111-1111-1111-111111111111',
      value: '11111111-1111-1111-1111-111111111111',
      options: { ex: 60 },
    });
    expect(calls.filter((call) => call.method === 'del')).toEqual([
      { method: 'del', key: 'kingbelt-session-preflight:11111111-1111-1111-1111-111111111111' },
    ]);
  });

  test('no inspecciona ni borra sesiones existentes', async () => {
    const source = readFileSync(join(root, 'scripts/session-preflight.ts'), 'utf8');
    expect(source).toContain('kingbelt-session-preflight:');
    expect(source).not.toContain('SCAN');
    expect(source).not.toContain('KEYS');
    expect(source).not.toContain('FLUSHDB');
    expect(source).not.toContain('FLUSHALL');
    expect(source).not.toContain('kingbelt-session:*');
    expect(source).not.toContain('Redis.fromEnv');
    expect(source).not.toContain("from 'astro'");
    expect(source).not.toContain('astro dev');
  });

  test('un fallo redacta token y URL', async () => {
    const { redis } = createMemoryRedis({ failOn: 'ping' });
    const io = captureIO();
    const code = await runSessionPreflightCli(validEnv(), { ...io, redis });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Session preflight failed');
    expect(io.failure()).not.toContain(VALID_TOKEN);
    expect(io.failure()).not.toContain(VALID_URL);
    expect(io.failure()).toContain('[redacted]');
  });

  test('PING inesperado falla sin imprimir la respuesta', async () => {
    const { redis } = createMemoryRedis({ ping: 'NOPE-SECRET' });
    const io = captureIO();
    const code = await runSessionPreflightCli(validEnv(), { ...io, redis });
    expect(code).toBe(1);
    expect(io.failure()).toContain('PING did not return PONG');
    expect(io.failure()).not.toContain('NOPE-SECRET');
  });

  test('TTL -1 indica que no se aplicó la expiración', async () => {
    const { redis, calls } = createMemoryRedis({ ttl: -1 });
    await expect(runSessionPreflight(validEnv(), { redis })).rejects.toThrow(/key expiry was not applied/);
    expect(calls.some((call) => call.method === 'del')).toBe(true);
  });

  test('DELETE fallido tras comprobaciones correctas hace fallar el preflight', async () => {
    const { redis } = createMemoryRedis({ failOn: 'del' });
    const io = captureIO();
    const code = await runSessionPreflightCli(validEnv(), { ...io, redis });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Session preflight failed');
    expect(io.failure()).not.toContain(VALID_TOKEN);
  });

  test('cleanup solo borra la clave efímera creada', async () => {
    const { redis, calls } = createMemoryRedis({ ping: 'NOPE' });
    const io = captureIO();
    await runSessionPreflightCli(validEnv(), {
      ...io,
      redis,
      randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
    const deleted = calls.filter((call) => call.method === 'del');
    expect(deleted).toEqual([
      { method: 'del', key: 'kingbelt-session-preflight:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    ]);
  });

  test('sanitize sustituye url y token por [redacted]', () => {
    const text = sanitizeSessionPreflightText(
      `authorization: Bearer ${VALID_TOKEN} connected to ${VALID_URL}`,
      { url: VALID_URL, token: VALID_TOKEN }
    );
    expect(text).not.toContain(VALID_TOKEN);
    expect(text).not.toContain(VALID_URL);
    expect(text).toContain('[redacted]');
  });

  test('el formato de error no incluye secretos', () => {
    const failure = formatSessionPreflightFailure(
      new Error(`token=${VALID_TOKEN} url=${VALID_URL}`),
      { url: VALID_URL, token: VALID_TOKEN }
    );
    expect(failure.startsWith('Session preflight failed\n')).toBe(true);
    expect(failure).not.toContain(VALID_TOKEN);
    expect(failure).not.toContain(VALID_URL);
  });
});
