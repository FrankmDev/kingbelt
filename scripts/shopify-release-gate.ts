import { spawnSync } from 'node:child_process';
import { CUSTOMER_ACCOUNT_REDIRECT_STATUS, parseShopifyHostedUrl } from '../src/commerce/application/hosted-url.ts';
import {
  parseSmokeBaseUrl,
  parseSmokeProductHandle,
  SMOKE_BASE_URL_ERROR,
} from './shopify-smoke-url.ts';

export const HTTP_TIMEOUT_MS = 15_000;
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const MIN_SECRET_LENGTH = 8;
export const CART_GID = 'gid://shopify/Cart/';
export const PDP_SIGNAL = 'data-product-page';
export const SECRET_EXPOSURE_ERROR = 'Secret material found in public HTML response.';
export const SECRET_JSON_EXPOSURE_ERROR = 'Secret material found in public JSON response.';
export const CART_ID_PUBLIC_ERROR = 'Remote Shopify Cart ID leaked through a public response.';
export const FULL_GIT_HISTORY_ERROR = 'full Git history required for secret history scan.';
export const LOCAL_DEPLOYMENT_ERROR = 'SHOPIFY_SMOKE_BASE_URL must be a real HTTPS deployment origin.';
export const SHOPIFY_SOURCE_ERROR = 'Shopify release gate requires COMMERCE_SOURCE=shopify.';
export const READY_STATUS = 'READY FOR PAYMENT QA';
export const BLOCKED_STATUS = 'BLOCKED';

const REQUIRED_SECURITY_HEADERS = [
  'Content-Security-Policy',
  'Referrer-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Permissions-Policy',
] as const;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const SENSITIVE_ENV_KEYS = [
  'SHOPIFY_STOREFRONT_PRIVATE_TOKEN',
  'UPSTASH_REDIS_REST_TOKEN',
  'SHOPIFY_WEBHOOK_SECRET',
  'VERCEL_DEPLOY_HOOK_URL',
] as const;

export type ReleaseGateStage =
  | 'configuration'
  | 'validate'
  | 'session:preflight'
  | 'shopify:preflight'
  | 'shopify:cart-smoke'
  | 'HTTP deployment checks';

export type ReleaseGateEnv = NodeJS.ProcessEnv;

export class ReleaseGateError extends Error {
  readonly name = 'ReleaseGateError';

  constructor(
    readonly stage: ReleaseGateStage,
    readonly reason: string
  ) {
    super(reason);
  }
}

export interface ReleaseGateCommandInput {
  stage: Exclude<ReleaseGateStage, 'configuration' | 'HTTP deployment checks'>;
  script: string;
  env: ReleaseGateEnv;
}

export interface ReleaseGateCommandResult {
  status: number | null;
}

export interface ReleaseGateIO {
  runCommand?: (input: ReleaseGateCommandInput) => ReleaseGateCommandResult;
  fetch?: typeof fetch;
  isShallowRepository?: () => boolean;
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
  cwd?: string;
}

export interface ReleaseGateSummary {
  status: 'READY_FOR_PAYMENT_QA';
}

export const RELEASE_GATE_COMMANDS = [
  { stage: 'validate', script: 'validate', commerceSource: 'demo' },
  { stage: 'session:preflight', script: 'session:preflight' },
  { stage: 'shopify:preflight', script: 'shopify:preflight', commerceSource: 'shopify' },
  { stage: 'shopify:cart-smoke', script: 'shopify:cart-smoke', commerceSource: 'shopify' },
] as const;

const fail = (stage: ReleaseGateStage, reason: string): never => {
  throw new ReleaseGateError(stage, reason);
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown release gate error.';

export const mediaType = (contentType: string | null): string =>
  contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';

export const parseCspDirectives = (csp: string): Map<string, string[]> => {
  const directives = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const name = tokens.shift()?.toLowerCase();
    if (!name) continue;
    directives.set(name, tokens.map((token) => token.toLowerCase()));
  }
  return directives;
};

const cspHas = (directives: Map<string, string[]>, name: string, token: string): boolean =>
  Boolean(directives.get(name)?.includes(token));

export const assertCriticalCsp = (csp: string, stage: ReleaseGateStage = 'HTTP deployment checks'): void => {
  const directives = parseCspDirectives(csp);
  if (!cspHas(directives, 'default-src', "'self'")) {
    fail(stage, "Content-Security-Policy default-src must include 'self'.");
  }
  if (!cspHas(directives, 'base-uri', "'self'")) {
    fail(stage, "Content-Security-Policy base-uri must include 'self'.");
  }
  if (!cspHas(directives, 'object-src', "'none'")) {
    fail(stage, "Content-Security-Policy object-src must include 'none'.");
  }
  if (!cspHas(directives, 'frame-ancestors', "'none'")) {
    fail(stage, "Content-Security-Policy frame-ancestors must include 'none'.");
  }
  if (!cspHas(directives, 'form-action', "'self'")) {
    fail(stage, "Content-Security-Policy form-action must include 'self'.");
  }
  if (!cspHas(directives, 'script-src', "'self'")) {
    fail(stage, "Content-Security-Policy script-src must include 'self'.");
  }
  if (!cspHas(directives, 'connect-src', "'self'")) {
    fail(stage, "Content-Security-Policy connect-src must include 'self'.");
  }
};

export const parseHstsMaxAge = (value: string): number | undefined => {
  const match = value.match(/max-age\s*=\s*(\d+)/i);
  if (!match) return undefined;
  const maxAge = Number(match[1]);
  return Number.isSafeInteger(maxAge) ? maxAge : undefined;
};

export const assertNoSensitiveValue = (
  body: string,
  secrets: readonly unknown[],
  message = SECRET_EXPOSURE_ERROR,
  stage: ReleaseGateStage = 'HTTP deployment checks'
): void => {
  for (const secret of secrets) {
    if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) continue;
    if (body.includes(secret)) fail(stage, message);
  }
};

export const assertNoPublicCartId = (
  body: string,
  stage: ReleaseGateStage = 'HTTP deployment checks'
): void => {
  if (body.includes(CART_GID) || /"cartId"\s*:/.test(body)) fail(stage, CART_ID_PUBLIC_ERROR);
};

export const isLocalDeploymentHost = (hostname: string): boolean =>
  LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost');

export const sensitiveEnvValues = (env: ReleaseGateEnv): string[] =>
  SENSITIVE_ENV_KEYS
    .map((key) => env[key])
    .filter((value): value is string => typeof value === 'string' && value.length >= MIN_SECRET_LENGTH);

const htmlPage = (pathname: string, response: { status: number; headers: Headers; body: string }): void => {
  if (response.status !== 200) fail('HTTP deployment checks', `${pathname} returned ${response.status}.`);
  if (mediaType(response.headers.get('content-type')) !== 'text/html') {
    fail('HTTP deployment checks', `${pathname} did not return HTML.`);
  }
};

export const assertHomeSecurityHeaders = (headers: Headers): void => {
  for (const name of REQUIRED_SECURITY_HEADERS) {
    const value = headers.get(name);
    if (!value?.trim()) fail('HTTP deployment checks', `${name} is missing.`);
  }

  assertCriticalCsp(headers.get('Content-Security-Policy') ?? '');

  if (headers.get('X-Content-Type-Options')?.trim().toLowerCase() !== 'nosniff') {
    fail('HTTP deployment checks', 'X-Content-Type-Options must be nosniff.');
  }
  if (headers.get('X-Frame-Options')?.trim().toUpperCase() !== 'DENY') {
    fail('HTTP deployment checks', 'X-Frame-Options must be DENY.');
  }

  const maxAge = parseHstsMaxAge(headers.get('Strict-Transport-Security') ?? '');
  if (maxAge === undefined || maxAge <= 0) {
    fail('HTTP deployment checks', 'Strict-Transport-Security must include max-age greater than 0.');
  }
  if (headers.get('Referrer-Policy')?.trim().toLowerCase() !== 'strict-origin-when-cross-origin') {
    fail('HTTP deployment checks', 'Referrer-Policy must be strict-origin-when-cross-origin.');
  }
};

const readLimitedBody = async (response: Response, maxBytes: number): Promise<string> => {
  const lengthHeader = response.headers.get('content-length');
  if (lengthHeader && /^[0-9]+$/.test(lengthHeader)) {
    const contentLength = Number(lengthHeader);
    if (Number.isSafeInteger(contentLength) && contentLength > maxBytes) {
      fail('HTTP deployment checks', 'HTTP response exceeded 2 MiB.');
    }
  }

  if (!response.body) return '';

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = response.body.getReader();
  } catch {
    return await response.text();
  }

  const chunks: Uint8Array[] = [];
  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    if (offset + value.byteLength > maxBytes) {
      await reader.cancel().catch(() => undefined);
      fail('HTTP deployment checks', 'HTTP response exceeded 2 MiB.');
    }
    chunks.push(value);
    offset += value.byteLength;
  }

  const buffer = new Uint8Array(offset);
  let cursor = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(buffer);
};

export const fetchWithTimeout = async (
  baseUrl: string,
  path: string,
  options: RequestInit & { fetchImpl?: typeof fetch } = {}
): Promise<{ status: number; headers: Headers; body: string; pathname: string }> => {
  const url = new URL(path, `${baseUrl}/`);
  const { fetchImpl = globalThis.fetch, ...init } = options;
  const response = await fetchImpl(url.href, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  }).catch((error: unknown) => {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return fail(
      'HTTP deployment checks',
      timedOut ? `${url.pathname} request timed out` : `${url.pathname} request failed`
    );
  });

  return {
    status: response.status,
    headers: response.headers,
    body: await readLimitedBody(response, MAX_BODY_BYTES),
    pathname: url.pathname,
  };
};

const parseHostedLocation = (raw: string, reason: string): URL => {
  try {
    return parseShopifyHostedUrl(raw);
  } catch {
    return fail('HTTP deployment checks', reason);
  }
};

export const assertAccountRedirect = (
  response: { status: number; headers: Headers },
  configuredUrl?: string
): void => {
  if (response.status === 200) {
    fail('HTTP deployment checks', '/cuenta/iniciar returned the local account panel.');
  }
  if (response.status !== CUSTOMER_ACCOUNT_REDIRECT_STATUS) {
    fail(
      'HTTP deployment checks',
      `/cuenta/iniciar returned ${response.status}; expected ${CUSTOMER_ACCOUNT_REDIRECT_STATUS}.`
    );
  }

  const location = response.headers.get('location');
  if (!location) return fail('HTTP deployment checks', '/cuenta/iniciar is missing Location.');

  const hosted = parseHostedLocation(
    location,
    'Customer Accounts Location is not a valid hosted HTTPS URL.'
  );

  if (!configuredUrl) return;

  const expected = parseHostedLocation(
    configuredUrl,
    'SHOPIFY_CUSTOMER_ACCOUNT_URL is not a valid hosted HTTPS URL.'
  );
  if (hosted.origin !== expected.origin || hosted.pathname !== expected.pathname) {
    fail('HTTP deployment checks', 'Customer Accounts redirect does not match SHOPIFY_CUSTOMER_ACCOUNT_URL.');
  }
};

export const assertCartRefreshHeaders = (response: { status: number; headers: Headers; body: string }): void => {
  if (response.status === 404) {
    fail('HTTP deployment checks', 'The target deployment does not expose the Shopify cart BFF.');
  }
  if (response.status !== 200) {
    fail('HTTP deployment checks', `/api/cart refresh returned ${response.status}.`);
  }
  if (mediaType(response.headers.get('content-type')) !== 'application/json') {
    fail('HTTP deployment checks', '/api/cart did not return JSON.');
  }
  const cacheControl = response.headers.get('cache-control') ?? '';
  if (!cacheControl.toLowerCase().includes('no-store')) {
    fail('HTTP deployment checks', '/api/cart Cache-Control must include no-store.');
  }
  assertNoPublicCartId(response.body);
};

export const isShallowGitRepository = (cwd = process.cwd()): boolean => {
  const result = spawnSync('git', ['rev-parse', '--is-shallow-repository'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0 && result.stdout.trim() === 'true';
};

export const runReleaseGateCommand = (
  input: ReleaseGateCommandInput,
  cwd = process.cwd()
): ReleaseGateCommandResult => {
  const result = spawnSync('bun', ['run', input.script], {
    cwd,
    env: input.env,
    stdio: 'inherit',
  });
  if (result.error) return { status: 1 };
  return { status: result.status };
};

const commandEnv = (
  env: ReleaseGateEnv,
  commerceSource?: 'demo' | 'shopify'
): ReleaseGateEnv => ({
  ...env,
  ...(commerceSource ? { COMMERCE_SOURCE: commerceSource } : {}),
});

const STAGE_LABELS: Record<ReleaseGateStage, string> = {
  configuration: 'configuration',
  validate: 'validate',
  'session:preflight': 'session preflight',
  'shopify:preflight': 'Shopify preflight',
  'shopify:cart-smoke': 'Shopify cart smoke',
  'HTTP deployment checks': 'HTTP deployment checks',
};

export const formatReleaseGateSuccess = (): string =>
  [
    'KingBelt pre-payment release gate passed',
    '',
    'Code validation: OK',
    'Session storage: OK',
    'Shopify catalog: OK',
    'Shopify market: OK',
    'Cart BFF: OK',
    'Cart persistence: OK',
    'Cart operations: OK',
    'Checkout preparation: OK',
    'Customer Accounts redirect: OK',
    'HTTP security headers: OK',
    'Public secret exposure: OK',
    'Order created: NO',
    'Payment attempted: NO',
    'Manual Shopify Admin gate: REQUIRED',
    '',
    'STATUS:',
    READY_STATUS,
  ].join('\n');

export const formatReleaseGateFailure = (error: unknown): string => {
  const gateError = error instanceof ReleaseGateError ? error : undefined;
  return [
    'KingBelt pre-payment release gate failed',
    '',
    'Stage:',
    gateError ? STAGE_LABELS[gateError.stage] : 'configuration',
    '',
    'Reason:',
    gateError?.reason ?? errorMessage(error),
    '',
    'STATUS:',
    BLOCKED_STATUS,
  ].join('\n');
};

const requireSmokeTarget = (env: ReleaseGateEnv): { baseUrl: string; handle: string } => {
  try {
    return {
      baseUrl: parseSmokeBaseUrl(env.SHOPIFY_SMOKE_BASE_URL),
      handle: parseSmokeProductHandle(env.SHOPIFY_SMOKE_PRODUCT_HANDLE),
    };
  } catch (error) {
    return fail('configuration', error instanceof Error ? error.message : SMOKE_BASE_URL_ERROR);
  }
};

export const runHttpDeploymentChecks = async (
  env: ReleaseGateEnv,
  io: Pick<ReleaseGateIO, 'fetch'> = {}
): Promise<void> => {
  const { baseUrl, handle } = requireSmokeTarget(env);

  if (isLocalDeploymentHost(new URL(baseUrl).hostname)) {
    fail('configuration', LOCAL_DEPLOYMENT_ERROR);
  }

  const origin = new URL(baseUrl).origin;
  const fetchImpl = io.fetch ?? globalThis.fetch;
  const secrets = sensitiveEnvValues(env);
  const get = (path: string) => fetchWithTimeout(baseUrl, path, { fetchImpl, method: 'GET' });

  const home = await get('/');
  htmlPage('/', home);
  assertHomeSecurityHeaders(home.headers);
  assertNoPublicCartId(home.body);
  assertNoSensitiveValue(home.body, secrets);

  const products = await get('/productos');
  htmlPage('/productos', products);
  assertNoPublicCartId(products.body);
  assertNoSensitiveValue(products.body, secrets);

  const pdp = await get(`/productos/${handle}`);
  htmlPage(`/productos/${handle}`, pdp);
  if (!pdp.body.includes(PDP_SIGNAL)) {
    fail('HTTP deployment checks', 'Pilot product page is missing the product document signal.');
  }
  assertNoPublicCartId(pdp.body);
  assertNoSensitiveValue(pdp.body, secrets);

  const cart = await get('/carrito');
  htmlPage('/carrito', cart);
  assertNoPublicCartId(cart.body);
  assertNoSensitiveValue(cart.body, secrets);

  const account = await get('/cuenta/iniciar');
  assertAccountRedirect(account, env.SHOPIFY_CUSTOMER_ACCOUNT_URL);

  const refresh = await fetchWithTimeout(baseUrl, '/api/cart', {
    fetchImpl,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify({ command: 'refresh' }),
  });
  assertCartRefreshHeaders(refresh);
  assertNoSensitiveValue(refresh.body, secrets, SECRET_JSON_EXPOSURE_ERROR);
};

export const runReleaseGate = async (
  env: ReleaseGateEnv,
  io: ReleaseGateIO = {}
): Promise<ReleaseGateSummary> => {
  if (env.COMMERCE_SOURCE !== 'shopify') fail('configuration', SHOPIFY_SOURCE_ERROR);

  const cwd = io.cwd ?? process.cwd();
  const isShallow = io.isShallowRepository ?? (() => isShallowGitRepository(cwd));
  if (isShallow()) fail('configuration', FULL_GIT_HISTORY_ERROR);

  try {
    const target = requireSmokeTarget(env);
    if (isLocalDeploymentHost(new URL(target.baseUrl).hostname)) {
      fail('configuration', LOCAL_DEPLOYMENT_ERROR);
    }
  } catch (error) {
    if (error instanceof ReleaseGateError) throw error;
    fail('configuration', error instanceof Error ? error.message : SMOKE_BASE_URL_ERROR);
  }

  const runCommand = io.runCommand ?? ((input) => runReleaseGateCommand(input, cwd));

  for (const command of RELEASE_GATE_COMMANDS) {
    const result = runCommand({
      stage: command.stage,
      script: command.script,
      env: commandEnv(env, 'commerceSource' in command ? command.commerceSource : undefined),
    });
    if (result.status !== 0) {
      fail(command.stage, `command exited with status ${result.status ?? 1}`);
    }
  }

  await runHttpDeploymentChecks(env, io);
  return { status: 'READY_FOR_PAYMENT_QA' };
};

export const runReleaseGateCli = async (
  env: ReleaseGateEnv = process.env,
  io: ReleaseGateIO = {}
): Promise<number> => {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  try {
    await runReleaseGate(env, io);
    stdout.write(`${formatReleaseGateSuccess()}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${formatReleaseGateFailure(error)}\n`);
    return 1;
  }
};
