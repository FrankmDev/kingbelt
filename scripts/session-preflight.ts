import { Redis } from '@upstash/redis';
import {
  resolveUpstashSessionCredentials,
  type UpstashSessionCredentials,
} from '../src/session-storage-config.ts';

const PREFLIGHT_KEY_PREFIX = 'kingbelt-session-preflight:';
const PREFLIGHT_TTL_SECONDS = 60;
const AUTH_HEADER_PATTERN = /(?:authorization)\s*[:=]\s*\S+/gi;

export type SessionPreflightEnv = NodeJS.ProcessEnv;

export class SessionPreflightError extends Error {
  readonly name = 'SessionPreflightError';

  constructor(message: string) {
    super(message);
  }
}

export interface SessionPreflightRedis {
  ping(): Promise<string>;
  set(key: string, value: string, options: { ex: number }): Promise<unknown>;
  get<T = string>(key: string): Promise<T | null>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<unknown>;
}

export interface SessionPreflightIO {
  redis?: SessionPreflightRedis;
  createRedis?: (credentials: UpstashSessionCredentials) => SessionPreflightRedis;
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
  randomUUID?: () => string;
}

const fail = (message: string): never => {
  throw new SessionPreflightError(message);
};

export const sanitizeSessionPreflightText = (
  value: string,
  credentials?: UpstashSessionCredentials
): string => {
  let sanitized = value;
  if (credentials?.url) sanitized = sanitized.split(credentials.url).join('[redacted]');
  if (credentials?.token) sanitized = sanitized.split(credentials.token).join('[redacted]');
  return sanitized
    .replace(AUTH_HEADER_PATTERN, '[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 500);
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown session preflight error.';

export const formatSessionPreflightSuccess = (): string =>
  [
    'Session preflight passed',
    'Upstash connectivity: OK',
    'Read/write: OK',
    'TTL: OK',
    'Cleanup: OK',
  ].join('\n');

export const formatSessionPreflightFailure = (
  error: unknown,
  credentials?: UpstashSessionCredentials
): string =>
  `Session preflight failed\n${sanitizeSessionPreflightText(errorMessage(error), credentials)}`;

const createRedisClient = (
  credentials: UpstashSessionCredentials,
  io: SessionPreflightIO
): SessionPreflightRedis => {
  if (io.redis) return io.redis;
  if (io.createRedis) return io.createRedis(credentials);
  return new Redis({
    url: credentials.url,
    token: credentials.token,
  });
};

export const runSessionPreflight = async (
  env: SessionPreflightEnv,
  io: SessionPreflightIO = {}
): Promise<void> => {
  const credentials = resolveUpstashSessionCredentials(env, { requireRemote: true });
  const redis = createRedisClient(credentials, io);
  const randomUUID = io.randomUUID ?? crypto.randomUUID.bind(crypto);
  const key = `${PREFLIGHT_KEY_PREFIX}${randomUUID()}`;
  const value = randomUUID();

  let primaryError: unknown;
  let checksPassed = false;

  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      fail('Upstash session preflight failed: PING did not return PONG.');
    }

    await redis.set(key, value, { ex: PREFLIGHT_TTL_SECONDS });

    const stored = await redis.get<string>(key);
    if (stored !== value) {
      fail('Upstash session preflight failed: stored value did not match.');
    }

    const ttl = await redis.ttl(key);
    if (ttl === -1) {
      fail('Upstash session preflight failed: key expiry was not applied.');
    }
    if (!(ttl > 0 && ttl <= PREFLIGHT_TTL_SECONDS)) {
      fail('Upstash session preflight failed: key TTL was not within the expected window.');
    }

    checksPassed = true;
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      await redis.del(key);
    } catch (cleanupError) {
      if (checksPassed) primaryError = cleanupError;
    }
  }

  if (primaryError) throw primaryError;
};

export const runSessionPreflightCli = async (
  env: SessionPreflightEnv = process.env,
  io: SessionPreflightIO = {}
): Promise<number> => {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  let credentials: UpstashSessionCredentials | undefined;
  try {
    credentials = resolveUpstashSessionCredentials(env, { requireRemote: true });
    await runSessionPreflight(env, io);
    stdout.write(`${formatSessionPreflightSuccess()}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${formatSessionPreflightFailure(error, credentials)}\n`);
    return 1;
  }
};
