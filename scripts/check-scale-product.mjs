import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const root = resolve(import.meta.dirname, '..');
const fixtureRoot = join(root, 'tests/fixtures/scale-site');
const distDir = join(fixtureRoot, 'dist');
const config = 'tests/fixtures/scale-site/astro.config.mjs';

const budgets = {
  // En CI el runner es más lento que un SSD local; los presupuestos de tamaño siguen siendo estrictos.
  buildMs: process.env.CI === 'true' ? 30_000 : 5_000,
  htmlBytes: 220_000,
  publicJsonBytes: 16_000,
  initialJsBytes: 90_000,
};

rmSync(distDir, { recursive: true, force: true });
const started = performance.now();
const astroBin = join(root, 'node_modules/.bin/astro');
const build = spawnSync(astroBin, ['build', '--config', config], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
  env: {
    ...process.env,
    COMMERCE_SOURCE: 'demo',
  },
});
const buildMs = Math.round(performance.now() - started);
if (build.status !== 0) {
  console.error(build.stdout);
  console.error(build.stderr);
  process.exit(1);
}

const htmlPath = join(distDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const payloadMatch = html.match(/<script type="application\/json" data-product-variants>(.*?)<\/script>/s);
if (!payloadMatch) throw new Error('La ficha renderizada no contiene el payload público de variantes.');

const payloadText = payloadMatch[1];
const payload = JSON.parse(payloadText);
const assetPath = (url) => join(distDir, url.replace(/^\//, ''));
const scriptEntries = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)]
  .map((match) => assetPath(match[1]));

const staticImports = (source, file) => [...source.matchAll(/(?:from\s*|import\s*)["']([^"']+\.js)["']/g)]
  .map((match) => resolve(dirname(file), match[1]));
const initialFiles = new Set();
const visit = (file) => {
  if (initialFiles.has(file) || !existsSync(file)) return;
  initialFiles.add(file);
  const source = readFileSync(file, 'utf8');
  staticImports(source, file).forEach(visit);
};
scriptEntries.forEach(visit);

const htmlBytes = statSync(htmlPath).size;
const publicJsonBytes = Buffer.byteLength(payloadText, 'utf8');
const initialJsBytes = [...initialFiles].reduce((total, file) => total + statSync(file).size, 0);
const cssBytes = readdirSync(join(distDir, '_astro'))
  .filter((file) => file.endsWith('.css'))
  .reduce((total, file) => total + statSync(join(distDir, '_astro', file)).size, 0);

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

assert(payload.v?.length === 76, `Se esperaban 76 variantes renderizadas y hay ${payload.v?.length ?? 0}.`);
assert(payload.o?.length === 2, 'El payload no conserva las dos opciones en orden.');
assert(payload.v?.every((variant) => Array.isArray(variant) && variant.length === 11), 'La proyección compacta contiene una tupla inválida.');
assert(
  !/(?:sku|inventory|quantityAvailable|unitCost|admin|vendor|title|name|token|secret|buyerIdentity|cartId|email|address)/i.test(payloadText),
  'El payload público expone nombres, secretos, identidad o campos administrativos redundantes.'
);

const bySelection = new Map(payload.v.map((variant) => [variant[1].join('\0'), variant]));
const missingCombination = ['scale:color:0', 'scale:size:80'].join('\0');
const availableVariant = bySelection.get(['scale:color:0', 'scale:size:85'].join('\0'));
const soldOutVariant = bySelection.get(['scale:color:3', 'scale:size:175'].join('\0'));
const unavailableVariant = bySelection.get(['scale:color:2', 'scale:size:170'].join('\0'));
assert(!bySelection.has(missingCombination), 'La combinación incompatible se ha generado de forma cartesiana.');
assert(Boolean(availableVariant), 'No se puede resolver una combinación válida por sus opciones.');
assert(availableVariant?.[2] === 8_910, 'La selección válida no conserva su precio exacto.');
assert(availableVariant?.[4] === 'scale:image:0:0', 'La selección válida no conserva la imagen principal de su color.');
assert(availableVariant?.[5] === 'a', 'La selección válida no conserva el estado comprable.');
assert(soldOutVariant?.[5] === 'o', 'La ficha no representa la variante agotada esperada.');
assert(unavailableVariant?.[5] === 'u', 'La ficha no representa la variante no publicada esperada.');
assert(new Set(payload.v.map((variant) => variant[2])).size > 1, 'La prueba no cubre cambios de precio.');
assert(new Set(payload.v.map((variant) => variant[5])).size >= 3, 'La prueba no cubre disponibilidad suficiente.');
assert(new Set(payload.v.map((variant) => variant[4])).size === 4, 'La relación variante-imagen por color es incorrecta.');
assert(payload.v.some((variant) => variant[6] === 4 && variant[7] === 1 && variant[8] === 1), 'La prueba no conserva mínimo, incremento y máximo de cantidad.');
assert((html.match(/data-product-option/g) ?? []).length >= 24, 'El HTML no contiene los controles de Color y Talla esperados.');
assert((html.match(/data-gallery-image-id/g) ?? []).length === 12, 'El HTML no contiene las tres imágenes renderizadas por color.');
assert(buildMs <= budgets.buildMs, `Build de escala: ${buildMs} ms > ${budgets.buildMs} ms.`);
assert(htmlBytes <= budgets.htmlBytes, `HTML de escala: ${htmlBytes} B > ${budgets.htmlBytes} B.`);
assert(publicJsonBytes <= budgets.publicJsonBytes, `JSON público: ${publicJsonBytes} B > ${budgets.publicJsonBytes} B.`);
assert(initialJsBytes <= budgets.initialJsBytes, `JavaScript inicial: ${initialJsBytes} B > ${budgets.initialJsBytes} B.`);

console.log(`Ficha 76 variantes: build ${buildMs} ms; HTML ${htmlBytes} B; JSON ${publicJsonBytes} B; JS inicial ${initialJsBytes} B; CSS ${cssBytes} B.`);
if (failures.length) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Prueba renderizada de 76 variantes dentro de presupuestos.');
