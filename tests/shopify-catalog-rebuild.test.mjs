import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  handleShopifyCatalogRebuild,
  isVercelDeployHookUrl,
  readLimitedWebhookBody,
  verifyShopifyWebhookHmac,
} from '../src/pages/api/shopify-catalog-rebuild.ts';

const root = resolve(import.meta.dir, '..');
const secret = 'test-webhook-secret-value';
const hookUrl = 'https://api.vercel.com/v1/integrations/deploy/prj_test123/hook456';
const body = '{"id":1}';
const hmac = createHmac('sha256', secret).update(body).digest('base64');

const env = {
  SHOPIFY_WEBHOOK_SECRET: secret,
  VERCEL_DEPLOY_HOOK_URL: hookUrl,
};

const captureFetch = (status = 201) => {
  const requests = [];
  const fetchImpl = async (input, init) => {
    requests.push({ input, init });
    return new Response(null, { status });
  };
  return { requests, fetchImpl };
};

describe('rebuild de catálogo por webhook', () => {
  test('acepta solo el Deploy Hook exacto de Vercel', () => {
    expect(isVercelDeployHookUrl(hookUrl)).toBe(true);
    expect(isVercelDeployHookUrl('https://evil.test/v1/integrations/deploy/prj_test123/hook456')).toBe(false);
    expect(isVercelDeployHookUrl(`${hookUrl}/extra`)).toBe(false);
    expect(isVercelDeployHookUrl('http://api.vercel.com/v1/integrations/deploy/prj_test123/hook456')).toBe(false);
  });

  test('verifica la firma HMAC de Shopify', () => {
    expect(verifyShopifyWebhookHmac(body, hmac, secret)).toBe(true);
    expect(verifyShopifyWebhookHmac(body, 'AAAA', secret)).toBe(false);
    expect(verifyShopifyWebhookHmac('{"id":2}', hmac, secret)).toBe(false);
  });

  test('dispara el rebuild solo con POST autenticado y un topic de catálogo', async () => {
    const { requests, fetchImpl } = captureFetch();
    const result = await handleShopifyCatalogRebuild({
      method: 'POST',
      headers: {
        'x-shopify-hmac-sha256': hmac,
        'x-shopify-topic': 'products/update',
      },
      rawBody: body,
      env,
      fetchImpl,
    });

    expect(result).toEqual({ status: 200, body: { ok: true, rebuild: true } });
    expect(requests).toHaveLength(1);
    expect(requests[0].input).toBe(hookUrl);
    expect(requests[0].init.method).toBe('POST');
    expect(requests[0].init.redirect).toBe('manual');
  });

  test('ignora topics ajenos y rechaza firmas o métodos inválidos', async () => {
    const { requests, fetchImpl } = captureFetch();
    const ignored = await handleShopifyCatalogRebuild({
      method: 'POST',
      headers: {
        'x-shopify-hmac-sha256': hmac,
        'x-shopify-topic': 'orders/create',
      },
      rawBody: body,
      env,
      fetchImpl,
    });
    const unauthorized = await handleShopifyCatalogRebuild({
      method: 'POST',
      headers: { 'x-shopify-hmac-sha256': 'bad', 'x-shopify-topic': 'products/update' },
      rawBody: body,
      env,
      fetchImpl,
    });
    const wrongMethod = await handleShopifyCatalogRebuild({
      method: 'GET',
      headers: {},
      rawBody: body,
      env,
      fetchImpl,
    });
    const unavailable = await handleShopifyCatalogRebuild({
      method: 'POST',
      headers: { 'x-shopify-hmac-sha256': hmac, 'x-shopify-topic': 'products/update' },
      rawBody: body,
      env: {},
      fetchImpl,
    });

    expect(ignored).toEqual({ status: 200, body: { ok: true, rebuild: false } });
    expect(unauthorized.status).toBe(401);
    expect(wrongMethod.status).toBe(405);
    expect(unavailable.status).toBe(503);
    expect(requests).toHaveLength(0);
  });

  test('limita el raw body mientras lee el stream, incluso sin Content-Length', async () => {
    const oversized = new Request('https://kingbelt.test/api/shopify-catalog-rebuild', {
      method: 'POST',
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(9).fill(97));
          controller.close();
        },
      }),
    });
    expect(await readLimitedWebhookBody(oversized, 8)).toEqual({
      ok: false,
      status: 413,
      error: 'payload_too_large',
    });
  });

  test('rechaza Content-Length malformado antes de materializar el raw body', async () => {
    const malformed = new Request('https://kingbelt.test/api/shopify-catalog-rebuild', {
      method: 'POST',
      headers: { 'Content-Length': '1x' },
      body: '{}',
    });
    expect(await readLimitedWebhookBody(malformed)).toEqual({
      ok: false,
      status: 400,
      error: 'invalid_body',
    });
  });

  test('el example documenta el secreto y el hook como secretos de servidor', () => {
    const example = readFileSync(join(root, '.env.example'), 'utf8');
    const astroConfig = readFileSync(join(root, 'astro.config.mjs'), 'utf8');
    const catalogRoot = readFileSync(join(root, 'src/commerce/catalog.ts'), 'utf8');

    expect(example).toContain('SHOPIFY_WEBHOOK_SECRET=');
    expect(example).toContain('VERCEL_DEPLOY_HOOK_URL=');
    expect(example).not.toMatch(/PUBLIC_SHOPIFY_WEBHOOK/);
    expect(astroConfig).toContain('SHOPIFY_WEBHOOK_SECRET:');
    expect(astroConfig).toContain('VERCEL_DEPLOY_HOOK_URL:');
    expect(astroConfig).toContain("access: 'secret'");
    expect(catalogRoot).toContain('import.meta.env.DEV ? 0 : 30_000');
  });
});
