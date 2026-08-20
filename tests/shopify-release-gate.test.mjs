import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  assertAccountRedirect,
  assertCartRefreshHeaders,
  assertCriticalCsp,
  assertHomeSecurityHeaders,
  assertNoPublicCartId,
  assertNoSensitiveValue,
  AUTOMATED_GATE_PASSED,
  BLOCKED_STATUS,
  CART_GID,
  CART_ID_PUBLIC_ERROR,
  formatReleaseGateFailure,
  formatReleaseGateSuccess,
  FULL_GIT_HISTORY_ERROR,
  LOCAL_DEPLOYMENT_ERROR,
  MANUAL_ADMIN_GATE_REQUIRED,
  PAYMENT_QA_READINESS_LABEL,
  RELEASE_GATE_COMMANDS,
  ReleaseGateError,
  runHttpDeploymentChecks,
  runReleaseGate,
  runReleaseGateCli,
  SECRET_EXPOSURE_ERROR,
} from '../scripts/shopify-release-gate.ts';

const root = resolve(import.meta.dir, '..');
const HANDLE = 'cinturon-atlas';
const BASE_URL = 'https://preview.example.test';
const ACCOUNT_URL = 'https://account.example.test';
const TOKEN = 'fake-private-token-value';
const UPSTASH_TOKEN = 'fake-upstash-token-value';
const WEBHOOK_SECRET = 'fake-webhook-secret-value';
const DEPLOY_HOOK = 'https://api.vercel.com/v1/integrations/deploy/fake-hook';

const SECURITY_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy':
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; connect-src 'self'",
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

const validEnv = (overrides = {}) => ({
  COMMERCE_SOURCE: 'shopify',
  SHOPIFY_SMOKE_BASE_URL: BASE_URL,
  SHOPIFY_SMOKE_PRODUCT_HANDLE: HANDLE,
  SHOPIFY_CUSTOMER_ACCOUNT_URL: ACCOUNT_URL,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: TOKEN,
  UPSTASH_REDIS_REST_TOKEN: UPSTASH_TOKEN,
  SHOPIFY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  VERCEL_DEPLOY_HOOK_URL: DEPLOY_HOOK,
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

const html = (body = '<html>ok</html>', init = {}) =>
  new Response(body, {
    status: init.status ?? 200,
    headers: { ...SECURITY_HEADERS, ...init.headers },
  });

const json = (body, init = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...init.headers,
    },
  });

const passingFetch = (overrides = {}) => async (input) => {
  const url = new URL(String(input));
  const path = url.pathname;
  if (overrides[path]) return overrides[path](url);
  if (path === '/api/cart') {
    return json({ success: true, cart: { lines: [], itemCount: 0 } });
  }
  if (path === '/cuenta/iniciar') {
    return new Response(null, {
      status: 307,
      headers: { location: `${ACCOUNT_URL}/` },
    });
  }
  if (path === `/productos/${HANDLE}`) {
    return html(`<article data-product-page>${HANDLE}</article>`);
  }
  return html();
};

const passingIO = (overrides = {}) => {
  const commands = [];
  return {
    commands,
    isShallowRepository: () => false,
    runCommand(input) {
      commands.push(input);
      return { status: 0 };
    },
    fetch: passingFetch(),
    ...overrides,
  };
};

const expectRejected = async (run, stage, reason) => {
  try {
    await run();
    throw new Error('expected release gate to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(ReleaseGateError);
    expect(error.stage).toBe(stage);
    expect(error.reason).toContain(reason);
    expect(error.reason).not.toContain(TOKEN);
    expect(error.reason).not.toContain(UPSTASH_TOKEN);
  }
};

describe('orquestación del release gate', () => {
  test('ejecuta validate, session, preflight, cart smoke y HTTP en ese orden', async () => {
    const io = passingIO();
    const result = await runReleaseGate(validEnv(), io);
    expect(result).toEqual({
      automatedPrePaymentGate: 'PASSED',
      manualShopifyAdminGate: 'REQUIRED',
      paymentQaReadiness: 'BLOCKED',
    });
    expect(io.commands.map((item) => item.script)).toEqual([
      'validate',
      'session:preflight',
      'shopify:preflight',
      'shopify:cart-smoke',
    ]);
    expect(io.commands[0].env.COMMERCE_SOURCE).toBe('demo');
    expect(io.commands[1].env.COMMERCE_SOURCE).toBe('shopify');
    expect(io.commands[2].env.COMMERCE_SOURCE).toBe('shopify');
    expect(io.commands[3].env.COMMERCE_SOURCE).toBe('shopify');
  });

  test('validate usa demo aunque el entorno exterior sea shopify', async () => {
    const io = passingIO();
    await runReleaseGate(validEnv({ COMMERCE_SOURCE: 'shopify' }), io);
    expect(io.commands[0].env.COMMERCE_SOURCE).toBe('demo');
    expect(io.commands[0].stage).toBe('validate');
  });

  test('si validate falla no ejecuta session ni Shopify', async () => {
    const io = passingIO({
      runCommand(input) {
        io.commands.push(input);
        return { status: input.script === 'validate' ? 1 : 0 };
      },
    });
    await expectRejected(() => runReleaseGate(validEnv(), io), 'validate', 'command exited with status 1');
    expect(io.commands.map((item) => item.script)).toEqual(['validate']);
  });

  test('si session preflight falla no ejecuta Shopify preflight', async () => {
    const io = passingIO({
      runCommand(input) {
        io.commands.push(input);
        return { status: input.script === 'session:preflight' ? 1 : 0 };
      },
    });
    await expectRejected(
      () => runReleaseGate(validEnv(), io),
      'session:preflight',
      'command exited with status 1'
    );
    expect(io.commands.map((item) => item.script)).toEqual(['validate', 'session:preflight']);
  });

  test('si Shopify preflight falla no ejecuta cart smoke', async () => {
    const io = passingIO({
      runCommand(input) {
        io.commands.push(input);
        return { status: input.script === 'shopify:preflight' ? 1 : 0 };
      },
    });
    await expectRejected(
      () => runReleaseGate(validEnv(), io),
      'shopify:preflight',
      'command exited with status 1'
    );
    expect(io.commands.map((item) => item.script)).toEqual([
      'validate',
      'session:preflight',
      'shopify:preflight',
    ]);
  });

  test('si cart smoke falla no ejecuta HTTP checks', async () => {
    let httpCalls = 0;
    const io = passingIO({
      runCommand(input) {
        io.commands.push(input);
        return { status: input.script === 'shopify:cart-smoke' ? 1 : 0 };
      },
      fetch: async (input) => {
        httpCalls += 1;
        return passingFetch()(input);
      },
    });
    await expectRejected(
      () => runReleaseGate(validEnv(), io),
      'shopify:cart-smoke',
      'command exited with status 1'
    );
    expect(httpCalls).toBe(0);
  });

  test('COMMERCE_SOURCE=demo no puede pasar el release gate', async () => {
    const io = passingIO();
    await expectRejected(
      () => runReleaseGate(validEnv({ COMMERCE_SOURCE: 'demo' }), io),
      'configuration',
      'COMMERCE_SOURCE=shopify'
    );
    expect(io.commands).toEqual([]);
  });

  test('un checkout Git shallow bloquea antes de los comandos', async () => {
    const io = passingIO({ isShallowRepository: () => true });
    await expectRejected(() => runReleaseGate(validEnv(), io), 'configuration', FULL_GIT_HISTORY_ERROR);
    expect(io.commands).toEqual([]);
  });

  test('localhost no certifica un deployment candidato', async () => {
    const io = passingIO();
    await expectRejected(
      () => runReleaseGate(validEnv({ SHOPIFY_SMOKE_BASE_URL: 'https://localhost' }), io),
      'configuration',
      LOCAL_DEPLOYMENT_ERROR
    );
    expect(io.commands).toEqual([]);
  });
});

describe('comprobaciones HTTP', () => {
  test('home 200 con cabeceras correctas pasa', async () => {
    await runHttpDeploymentChecks(validEnv(), { fetch: passingFetch() });
  });

  test('home 500 falla', async () => {
    await expectRejected(
      () => runHttpDeploymentChecks(validEnv(), {
        fetch: passingFetch({
          '/': () => html('<html>error</html>', { status: 500 }),
        }),
      }),
      'HTTP deployment checks',
      '/ returned 500'
    );
  });

  test('CSP ausente falla', () => {
    const headers = new Headers(SECURITY_HEADERS);
    headers.delete('Content-Security-Policy');
    expect(() => assertHomeSecurityHeaders(headers)).toThrow('Content-Security-Policy is missing.');
  });

  test('object-src que no es none falla', () => {
    expect(() => assertCriticalCsp("default-src 'self'; base-uri 'self'; object-src 'self'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; connect-src 'self'"))
      .toThrow("object-src must include 'none'");
  });

  test('frame-ancestors que no es none falla', () => {
    expect(() => assertCriticalCsp("default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self'; connect-src 'self'"))
      .toThrow("frame-ancestors must include 'none'");
  });

  test('X-Content-Type-Options ausente falla', () => {
    const headers = new Headers(SECURITY_HEADERS);
    headers.delete('X-Content-Type-Options');
    expect(() => assertHomeSecurityHeaders(headers)).toThrow('X-Content-Type-Options is missing.');
  });

  test('HSTS ausente falla', () => {
    const headers = new Headers(SECURITY_HEADERS);
    headers.delete('Strict-Transport-Security');
    expect(() => assertHomeSecurityHeaders(headers)).toThrow('Strict-Transport-Security is missing.');
  });

  test('account 307 con Location válida pasa', () => {
    assertAccountRedirect({
      status: 307,
      headers: new Headers({ location: `${ACCOUNT_URL}/` }),
    }, ACCOUNT_URL);
  });

  test('account 200 del panel local falla', () => {
    expect(() => assertAccountRedirect({
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
    })).toThrow('local account panel');
  });

  test('account 302 falla si el contrato exige 307', () => {
    expect(() => assertAccountRedirect({
      status: 302,
      headers: new Headers({ location: `${ACCOUNT_URL}/` }),
    }, ACCOUNT_URL)).toThrow('expected 307');
  });

  test('account Location HTTP falla', () => {
    expect(() => assertAccountRedirect({
      status: 307,
      headers: new Headers({ location: 'http://account.example.test/' }),
    })).toThrow('valid hosted HTTPS URL');
  });

  test('HTML con un secreto configurado falla sin imprimirlo', async () => {
    const io = captureIO();
    const code = await runReleaseGateCli(validEnv(), {
      ...passingIO({
        fetch: passingFetch({
          '/': () => html(`<html>${TOKEN}</html>`),
        }),
      }),
      ...io,
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain(SECRET_EXPOSURE_ERROR);
    expect(io.failure()).not.toContain(TOKEN);
    expect(io.success()).toBe('');
  });

  test('HTML o JSON con Cart ID remoto falla', () => {
    expect(() => assertNoPublicCartId(`<html>${CART_GID}test-secret</html>`)).toThrow(CART_ID_PUBLIC_ERROR);
    expect(() => assertNoPublicCartId('{"cartId":"gid://shopify/Cart/test-secret"}')).toThrow(CART_ID_PUBLIC_ERROR);
  });

  test('/api/cart exige Cache-Control no-store', () => {
    assertCartRefreshHeaders({
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
        'cache-control': 'no-store',
      }),
      body: '{"success":true,"cart":{"lines":[]}}',
    });
    expect(() => assertCartRefreshHeaders({
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
        'cache-control': 'max-age=60',
      }),
      body: '{"success":true,"cart":{"lines":[]}}',
    })).toThrow('no-store');
  });

  test('assertNoSensitiveValue ignora secretos vacíos o cortos', () => {
    expect(() => assertNoSensitiveValue('hello', [undefined, '', 'short'])).not.toThrow();
    expect(() => assertNoSensitiveValue(`leak ${TOKEN}`, [TOKEN])).toThrow(SECRET_EXPOSURE_ERROR);
  });
});

describe('resultado final', () => {
  test('todos los gates automáticos PASS dejan Payment QA BLOCKED', async () => {
    const io = captureIO();
    const code = await runReleaseGateCli(validEnv(), { ...passingIO(), ...io });
    expect(code).toBe(0);
    expect(io.success()).toContain('KingBelt pre-payment release gate passed');
    expect(io.success()).toContain(AUTOMATED_GATE_PASSED);
    expect(io.success()).toContain(MANUAL_ADMIN_GATE_REQUIRED);
    expect(io.success()).toContain(`${PAYMENT_QA_READINESS_LABEL}\n${BLOCKED_STATUS}`);
    expect(io.success()).toContain('Order created: NO');
    expect(io.success()).toContain('Payment attempted: NO');
    expect(io.success()).not.toContain('READY FOR PAYMENT QA');
    expect(io.success()).not.toContain('PARTIAL_READY');
    expect(io.failure()).toBe('');
  });

  test('un fallo automático produce STATUS BLOCKED', async () => {
    const formatted = formatReleaseGateFailure(
      new ReleaseGateError('shopify:cart-smoke', 'command exited with status 1')
    );
    expect(formatted).toContain('KingBelt pre-payment release gate failed');
    expect(formatted).toContain('Shopify cart smoke');
    expect(formatted).toContain('command exited with status 1');
    expect(formatted).toContain(`STATUS:\n${BLOCKED_STATUS}`);
    expect(formatted).not.toContain('READY FOR PAYMENT QA');
    expect(formatted).not.toContain(AUTOMATED_GATE_PASSED);
  });
});

describe('contrato del comando shopify:release-gate', () => {
  test('reutiliza gates existentes, no duplica validate y no entra en CI público', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const workflow = readFileSync(join(root, '.github/workflows/quality.yml'), 'utf8');
    const gate = readFileSync(join(root, 'scripts/shopify-release-gate.ts'), 'utf8');
    const cli = readFileSync(join(root, 'scripts/shopify-release-gate.mjs'), 'utf8');
    const example = readFileSync(join(root, '.env.example'), 'utf8');

    expect(pkg.scripts['shopify:release-gate']).toBe('bun scripts/shopify-release-gate.mjs');
    expect(pkg.scripts.validate).not.toContain('shopify:release-gate');
    expect(pkg.scripts.validate).not.toContain('shopify:preflight');
    expect(workflow).not.toContain('shopify:release-gate');
    expect(workflow).not.toContain('SHOPIFY_SMOKE_BASE_URL');

    expect(RELEASE_GATE_COMMANDS.map((item) => item.script)).toEqual([
      'validate',
      'session:preflight',
      'shopify:preflight',
      'shopify:cart-smoke',
    ]);
    expect(gate).toContain("commerceSource: 'demo'");
    expect(gate).toContain("commerceSource: 'shopify'");
    expect(gate).toContain('COMMERCE_SOURCE');
    expect(gate).toContain("stdio: 'inherit'");
    expect(gate).toContain("spawnSync('bun', ['run', input.script]");
    expect(gate).not.toContain('shell: true');
    expect(gate).not.toContain('shopify-cart-smoke.mjs');
    expect(gate).not.toContain('GITHUB_TOKEN');
    expect(gate).not.toContain('vercel promote');
    expect(gate).not.toContain('vercel --prod');
    expect(gate).not.toContain('Playwright');
    expect(gate).not.toContain('Admin API');
    expect(gate).not.toContain('READY FOR PAYMENT QA');
    expect(gate).not.toContain('SHIPPING_READY');
    expect(gate).not.toContain('TAX_READY');
    expect(gate).not.toContain('deliveryAddress');
    expect(gate).not.toContain("command: 'add'");
    expect(gate).toContain("command: 'refresh'");
    expect(gate).not.toMatch(/fetch\(result\.url\)|fetch\(checkout/);
    expect(cli).toContain('runReleaseGateCli');
    expect(example).toContain('SHOPIFY_SMOKE_BASE_URL=');
  });
});
