import { createHmac, timingSafeEqual } from 'node:crypto';
import type { APIRoute } from 'astro';

export const prerender = false;

export const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

export const CATALOG_REBUILD_TOPICS: readonly string[] = [
  'products/create',
  'products/update',
  'products/delete',
  'collections/create',
  'collections/update',
  'collections/delete',
];

const DEPLOY_HOOK_PATTERN =
  /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;

export const isVercelDeployHookUrl = (value: unknown): value is string =>
  typeof value === 'string' && DEPLOY_HOOK_PATTERN.test(value);

export const verifyShopifyWebhookHmac = (
  rawBody: Buffer | string,
  hmacHeader: unknown,
  secret: unknown
): boolean => {
  if (typeof hmacHeader !== 'string' || typeof secret !== 'string' || secret.length < 16) {
    return false;
  }
  const digest = createHmac('sha256', secret).update(rawBody).digest('base64');
  const expected = Buffer.from(digest);
  const received = Buffer.from(hmacHeader);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

type WebhookHeaders = Record<string, string | string[] | undefined>;

const headerValue = (headers: WebhookHeaders, name: string): string | undefined => {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

export interface RebuildHandlerInput {
  method: string;
  headers: WebhookHeaders;
  rawBody: Buffer | string | null | undefined;
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export interface RebuildHandlerResult {
  status: number;
  body: Record<string, unknown>;
}

export const handleShopifyCatalogRebuild = async ({
  method,
  headers,
  rawBody,
  env,
  fetchImpl = fetch,
}: RebuildHandlerInput): Promise<RebuildHandlerResult> => {
  if (method !== 'POST') {
    return { status: 405, body: { error: 'method_not_allowed' } };
  }

  const secret = env.SHOPIFY_WEBHOOK_SECRET;
  const hookUrl = env.VERCEL_DEPLOY_HOOK_URL;
  if (typeof secret !== 'string' || secret.length < 16 || !isVercelDeployHookUrl(hookUrl)) {
    return { status: 503, body: { error: 'rebuild_unavailable' } };
  }

  if (typeof rawBody === 'object' && rawBody !== null && !Buffer.isBuffer(rawBody)) {
    return { status: 400, body: { error: 'invalid_body' } };
  }
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody ?? '');
  if (body.length > MAX_WEBHOOK_BODY_BYTES) {
    return { status: 413, body: { error: 'payload_too_large' } };
  }

  const hmacHeader = headerValue(headers, 'x-shopify-hmac-sha256');
  if (!verifyShopifyWebhookHmac(body, hmacHeader, secret)) {
    return { status: 401, body: { error: 'unauthorized' } };
  }

  const topic = headerValue(headers, 'x-shopify-topic');
  if (!topic || !CATALOG_REBUILD_TOPICS.includes(topic)) {
    return { status: 200, body: { ok: true, rebuild: false } };
  }

  let response: Response;
  try {
    response = await fetchImpl(hookUrl, {
      method: 'POST',
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return { status: 502, body: { error: 'rebuild_failed' } };
  }
  if (response.status < 200 || response.status >= 300) {
    return { status: 502, body: { error: 'rebuild_failed' } };
  }

  return { status: 200, body: { ok: true, rebuild: true } };
};

const toResponse = (result: RebuildHandlerResult): Response =>
  new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const handleRequest: APIRoute = async ({ request }) =>
  toResponse(await handleShopifyCatalogRebuild({
    method: request.method,
    headers: Object.fromEntries(request.headers),
    rawBody: Buffer.from(await request.arrayBuffer()),
    env: process.env,
  }));

export const POST: APIRoute = handleRequest;
// Cualquier otro método recibe el 405 cerrado del manejador.
export const ALL: APIRoute = handleRequest;
