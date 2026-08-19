import { afterEach, describe, expect, test } from 'bun:test';
import createSessionDriver, {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionDriverConfig,
} from '../src/session-driver.ts';

const originalEnv = {
  VERCEL: process.env.VERCEL,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
};

afterEach(() => {
  if (originalEnv.VERCEL === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalEnv.VERCEL;
  if (originalEnv.UPSTASH_REDIS_REST_URL === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalEnv.UPSTASH_REDIS_REST_URL;
  if (originalEnv.UPSTASH_REDIS_REST_TOKEN === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalEnv.UPSTASH_REDIS_REST_TOKEN;
});

describe('driver de sesión Astro', () => {
  test('la cookie de sesión es opaca y host-only', () => {
    expect(SESSION_COOKIE_NAME).toBe('__Host-kingbelt-session');
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 30);
    expect(String(sessionDriverConfig.entrypoint)).toContain('session-driver.ts');
  });

  test('en local sin Redis usa disco, no memoria de proceso', () => {
    delete process.env.VERCEL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const driver = createSessionDriver();
    expect(driver.name).toBe('fs-lite');
    expect(typeof driver.getItem).toBe('function');
    expect(typeof driver.setItem).toBe('function');
    expect(typeof driver.removeItem).toBe('function');
  });

  test('en Vercel exige Redis/KV persistente', () => {
    process.env.VERCEL = '1';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(() => createSessionDriver()).toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  test('con credenciales Upstash usa el driver Redis REST', () => {
    process.env.VERCEL = '1';
    process.env.UPSTASH_REDIS_REST_URL = 'https://example-upstash.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'example-upstash-token';
    const driver = createSessionDriver();
    expect(driver.name).toBe('upstash');
    expect(typeof driver.getItem).toBe('function');
    expect(typeof driver.setItem).toBe('function');
    expect(typeof driver.removeItem).toBe('function');
  });
});
