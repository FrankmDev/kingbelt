export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_STORE_PREFIX = 'kingbelt-session';
export const LOCAL_SESSION_PATH = '.astro/session';
/** Cookie opaca de sesión. El prefijo `__Host-` exige Secure, Path=/ y ausencia de Domain. */
export const SESSION_COOKIE_NAME = '__Host-kingbelt-session';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const MAX_UPSTASH_TOKEN_LENGTH = 4_096;
const PARTIAL_CREDENTIALS_MESSAGE =
  'Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together.';
const VERCEL_CREDENTIALS_MESSAGE =
  'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for session storage on Vercel.';
const UPSTASH_URL_MESSAGE =
  'UPSTASH_REDIS_REST_URL must be an absolute HTTPS URL without credentials, query, or fragment.';
const UPSTASH_TOKEN_MESSAGE =
  'UPSTASH_REDIS_REST_TOKEN must be a non-empty secret without whitespace or control characters.';

export interface UpstashSessionCredentials {
  url: string;
  token: string;
}

export class SessionStorageConfigurationError extends Error {
  readonly name = 'SessionStorageConfigurationError';

  constructor(message: string) {
    super(message);
  }
}

export interface ResolveUpstashSessionCredentialsOptions {
  requireRemote?: boolean;
}

const isDefined = (value: string | undefined): value is string => typeof value === 'string';

const parseUpstashUrl = (rawUrl: string): string => {
  if (
    !rawUrl
    || rawUrl !== rawUrl.trim()
    || CONTROL_CHARACTER_PATTERN.test(rawUrl)
    || /\s/.test(rawUrl)
    || rawUrl.includes('?')
    || rawUrl.includes('#')
  ) {
    throw new SessionStorageConfigurationError(UPSTASH_URL_MESSAGE);
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SessionStorageConfigurationError(UPSTASH_URL_MESSAGE);
  }

  if (
    url.protocol !== 'https:'
    || !url.hostname
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new SessionStorageConfigurationError(UPSTASH_URL_MESSAGE);
  }

  return rawUrl;
};

const parseUpstashToken = (rawToken: string): string => {
  if (
    !rawToken
    || rawToken.length > MAX_UPSTASH_TOKEN_LENGTH
    || rawToken !== rawToken.trim()
    || CONTROL_CHARACTER_PATTERN.test(rawToken)
    || /\s/.test(rawToken)
  ) {
    throw new SessionStorageConfigurationError(UPSTASH_TOKEN_MESSAGE);
  }

  return rawToken;
};

export function resolveUpstashSessionCredentials(
  env: NodeJS.ProcessEnv,
  options: ResolveUpstashSessionCredentialsOptions & { requireRemote: true }
): UpstashSessionCredentials;
export function resolveUpstashSessionCredentials(
  env: NodeJS.ProcessEnv,
  options?: ResolveUpstashSessionCredentialsOptions
): UpstashSessionCredentials | undefined;
export function resolveUpstashSessionCredentials(
  env: NodeJS.ProcessEnv,
  options: ResolveUpstashSessionCredentialsOptions = {}
): UpstashSessionCredentials | undefined {
  const rawUrl = env.UPSTASH_REDIS_REST_URL;
  const rawToken = env.UPSTASH_REDIS_REST_TOKEN;
  const hasUrl = isDefined(rawUrl);
  const hasToken = isDefined(rawToken);

  if (!hasUrl && !hasToken) {
    if (options.requireRemote) {
      throw new SessionStorageConfigurationError(PARTIAL_CREDENTIALS_MESSAGE);
    }
    if (env.VERCEL) {
      throw new SessionStorageConfigurationError(VERCEL_CREDENTIALS_MESSAGE);
    }
    return undefined;
  }

  if (!hasUrl || !hasToken) {
    throw new SessionStorageConfigurationError(PARTIAL_CREDENTIALS_MESSAGE);
  }

  return {
    url: parseUpstashUrl(rawUrl),
    token: parseUpstashToken(rawToken),
  };
}
