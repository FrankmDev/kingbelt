import { describe, expect, test } from 'bun:test';
import {
  LOCAL_SESSION_PATH,
  SESSION_STORE_PREFIX,
  SESSION_TTL_SECONDS,
  SessionStorageConfigurationError,
  resolveUpstashSessionCredentials,
} from '../src/session-storage-config.ts';

const VALID_URL = 'https://example.upstash.io';
const VALID_TOKEN = 'example-upstash-token';

const env = (overrides = {}) => ({ ...overrides });

const expectConfigError = (environment, message, options) => {
  expect(() => resolveUpstashSessionCredentials(environment, options)).toThrow(SessionStorageConfigurationError);
  expect(() => resolveUpstashSessionCredentials(environment, options)).toThrow(message);
};

describe('credenciales del store de sesiones', () => {
  test('local sin Upstash permite almacenamiento en disco', () => {
    expect(resolveUpstashSessionCredentials(env())).toBeUndefined();
    expect(LOCAL_SESSION_PATH).toBe('.astro/session');
    expect(SESSION_STORE_PREFIX).toBe('kingbelt-session');
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 30);
  });

  test('Vercel sin Upstash falla cerrado', () => {
    expectConfigError(
      env({ VERCEL: '1' }),
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for session storage on Vercel.'
    );
  });

  test('preflight exige ambas credenciales también en local', () => {
    expectConfigError(
      env(),
      'Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together.',
      { requireRemote: true }
    );
  });

  test('URL sola falla', () => {
    expectConfigError(
      env({ UPSTASH_REDIS_REST_URL: VALID_URL }),
      'Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together.'
    );
  });

  test('token solo falla', () => {
    expectConfigError(
      env({ UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN }),
      'Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together.'
    );
  });

  test('URL con espacios exteriores falla', () => {
    expectConfigError(
      env({
        UPSTASH_REDIS_REST_URL: ` ${VALID_URL} `,
        UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
      }),
      'UPSTASH_REDIS_REST_URL must be an absolute HTTPS URL without credentials, query, or fragment.'
    );
  });

  test('token con espacios exteriores falla', () => {
    expectConfigError(
      env({
        UPSTASH_REDIS_REST_URL: VALID_URL,
        UPSTASH_REDIS_REST_TOKEN: ` ${VALID_TOKEN} `,
      }),
      'UPSTASH_REDIS_REST_TOKEN must be a non-empty secret without whitespace or control characters.'
    );
  });

  test('token con CR/LF falla', () => {
    expectConfigError(
      env({
        UPSTASH_REDIS_REST_URL: VALID_URL,
        UPSTASH_REDIS_REST_TOKEN: `${VALID_TOKEN}\n`,
      }),
      'UPSTASH_REDIS_REST_TOKEN must be a non-empty secret without whitespace or control characters.'
    );
    expectConfigError(
      env({
        UPSTASH_REDIS_REST_URL: VALID_URL,
        UPSTASH_REDIS_REST_TOKEN: `${VALID_TOKEN}\r`,
      }),
      'UPSTASH_REDIS_REST_TOKEN must be a non-empty secret without whitespace or control characters.'
    );
  });

  test('URL HTTP falla', () => {
    expectConfigError(
      env({
        UPSTASH_REDIS_REST_URL: 'http://example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
      }),
      'UPSTASH_REDIS_REST_URL must be an absolute HTTPS URL without credentials, query, or fragment.'
    );
  });

  test('URL con credenciales falla', () => {
    expectConfigError(
      env({
        UPSTASH_REDIS_REST_URL: 'https://user:secret@example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
      }),
      'UPSTASH_REDIS_REST_URL must be an absolute HTTPS URL without credentials, query, or fragment.'
    );
  });

  test('URL con query o fragment falla', () => {
    expectConfigError(
      env({
        UPSTASH_REDIS_REST_URL: `${VALID_URL}?token=1`,
        UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
      }),
      'UPSTASH_REDIS_REST_URL must be an absolute HTTPS URL without credentials, query, or fragment.'
    );
    expectConfigError(
      env({
        UPSTASH_REDIS_REST_URL: `${VALID_URL}#hash`,
        UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
      }),
      'UPSTASH_REDIS_REST_URL must be an absolute HTTPS URL without credentials, query, or fragment.'
    );
  });

  test('los errores de URL no incluyen el valor configurado', () => {
    const invalid = 'http://user:leaked-secret@example.upstash.io/path?x=1#frag';
    try {
      resolveUpstashSessionCredentials(env({
        UPSTASH_REDIS_REST_URL: invalid,
        UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
      }));
      throw new Error('expected configuration error');
    } catch (error) {
      expect(error).toBeInstanceOf(SessionStorageConfigurationError);
      expect(String(error.message)).not.toContain(invalid);
      expect(String(error.message)).not.toContain('leaked-secret');
      expect(String(error.message)).not.toContain(VALID_TOKEN);
    }
  });

  test('HTTPS válido y token válido resuelven credenciales', () => {
    expect(resolveUpstashSessionCredentials(env({
      UPSTASH_REDIS_REST_URL: VALID_URL,
      UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
    }))).toEqual({ url: VALID_URL, token: VALID_TOKEN });
    expect(resolveUpstashSessionCredentials(env({
      VERCEL: '1',
      UPSTASH_REDIS_REST_URL: `${VALID_URL}/`,
      UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
    }))).toEqual({ url: `${VALID_URL}/`, token: VALID_TOKEN });
  });
});
