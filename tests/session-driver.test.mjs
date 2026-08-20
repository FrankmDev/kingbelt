import { afterEach, describe, expect, mock, test } from 'bun:test';

let lastUpstashOptions;

mock.module('unstorage/drivers/upstash', () => ({
  default(options) {
    lastUpstashOptions = options;
    return {
      name: 'upstash',
      getItem() {},
      setItem() {},
      removeItem() {},
    };
  },
}));

const {
  default: createSessionDriver,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionDriverConfig,
} = await import('../src/session-driver.ts');
const { SESSION_STORE_PREFIX } = await import('../src/session-storage-config.ts');

const originalEnv = {
  VERCEL: process.env.VERCEL,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
};

const restoreEnv = (name, previous) => {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
};

afterEach(() => {
  lastUpstashOptions = undefined;
  restoreEnv('VERCEL', originalEnv.VERCEL);
  restoreEnv('UPSTASH_REDIS_REST_URL', originalEnv.UPSTASH_REDIS_REST_URL);
  restoreEnv('UPSTASH_REDIS_REST_TOKEN', originalEnv.UPSTASH_REDIS_REST_TOKEN);
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
    expect(lastUpstashOptions).toBeUndefined();
  });

  test('en Vercel exige Redis/KV persistente', () => {
    process.env.VERCEL = '1';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(() => createSessionDriver()).toThrow(/required for session storage on Vercel/);
  });

  test('credenciales parciales no caen a disco', () => {
    delete process.env.VERCEL;
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(() => createSessionDriver()).toThrow(/must be configured together/);
  });

  test('con credenciales Upstash usa el driver Redis REST', () => {
    process.env.VERCEL = '1';
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'example-upstash-token';
    const driver = createSessionDriver();
    expect(driver.name).toBe('upstash');
    expect(typeof driver.getItem).toBe('function');
    expect(typeof driver.setItem).toBe('function');
    expect(typeof driver.removeItem).toBe('function');
    expect(lastUpstashOptions).toEqual({
      url: 'https://example.upstash.io',
      token: 'example-upstash-token',
      base: SESSION_STORE_PREFIX,
      ttl: SESSION_TTL_SECONDS,
    });
  });

  test('local con credenciales válidas también usa Upstash', () => {
    delete process.env.VERCEL;
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io/';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'example-upstash-token';
    const driver = createSessionDriver();
    expect(driver.name).toBe('upstash');
    expect(lastUpstashOptions?.base).toBe('kingbelt-session');
    expect(lastUpstashOptions?.ttl).toBe(SESSION_TTL_SECONDS);
  });
});
