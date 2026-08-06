import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const distDir = join(root, 'dist');

if (!existsSync(distDir)) {
  console.error('dist/ no existe. Ejecuta `bun run build` antes de comprobar presupuestos.');
  process.exit(1);
}

const readText = (relativePath) => readFileSync(join(distDir, relativePath), 'utf8');

const fileSize = (relativePath) => {
  const absolutePath = join(distDir, relativePath);
  if (!existsSync(absolutePath)) return 0;
  return statSync(absolutePath).size;
};

const listAssets = (extension) => {
  const assets = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(extension)) assets.push(path.slice(distDir.length + 1));
    }
  };
  walk(join(distDir, '_astro'));
  return assets;
};

const assetUrls = (htmlPath, pattern) => {
  const html = readText(htmlPath);
  return [...html.matchAll(pattern)].map((match) => match[1]);
};

const scriptSrcs = (htmlPath) => assetUrls(htmlPath, /<script[^>]+src="([^"]+\.js)"/g);
const stylesheetHrefs = (htmlPath) =>
  assetUrls(htmlPath, /<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g);

const linkedCssBytes = (htmlPath) => {
  return stylesheetHrefs(htmlPath)
    .reduce((total, href) => total + fileSize(href.replace(/^\//, '')), 0);
};

const staticImports = (source, file) =>
  [...source.matchAll(/(?:from\s*|import\s*)["']([^"']+\.js)["']/g)]
    .map((match) => resolve(file, '..', match[1]));

const initialJsFiles = (htmlPath) => {
  const files = new Set();
  const visit = (file) => {
    if (files.has(file) || !existsSync(file)) return;
    files.add(file);
    staticImports(readFileSync(file, 'utf8'), file).forEach(visit);
  };
  scriptSrcs(htmlPath).map((src) => join(distDir, src.replace(/^\//, ''))).forEach(visit);
  return [...files];
};

const initialJsBytes = (htmlPath) =>
  initialJsFiles(htmlPath).reduce((total, file) => total + statSync(file).size, 0);

const maxVariantJsonBytes = () => {
  const productDir = join(distDir, 'productos');
  let maxBytes = 0;
  let largestHandle = '';

  for (const entry of readdirSync(productDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const html = readFileSync(join(productDir, entry.name, 'index.html'), 'utf8');
    const match = html.match(/<script type="application\/json" data-product-variants>(.*?)<\/script>/s);
    if (!match) continue;
    const bytes = Buffer.byteLength(match[1], 'utf8');
    if (bytes > maxBytes) {
      maxBytes = bytes;
      largestHandle = entry.name;
    }
  }

  return { maxBytes, largestHandle };
};

const largestProductPage = () => {
  const productDir = join(distDir, 'productos');
  let result = { htmlPath: '', jsBytes: 0, scriptRequests: 0 };
  for (const entry of readdirSync(productDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const htmlPath = `productos/${entry.name}/index.html`;
    const jsBytes = initialJsBytes(htmlPath);
    if (jsBytes > result.jsBytes) {
      result = { htmlPath, jsBytes, scriptRequests: scriptSrcs(htmlPath).length };
    }
  }
  return result;
};

const productPage = largestProductPage();

const budgets = [
  {
    name: 'páginas editoriales sin comercio: JS inicial',
    htmlPath: 'aviso-legal/index.html',
    actual: initialJsBytes('aviso-legal/index.html'),
    // 9,1 KB medidos: cabecera, pie y carga diferida del carrito; margen ≈15 %.
    max: 10_500,
  },
  {
    name: 'páginas editoriales: peticiones de script iniciales',
    htmlPath: 'aviso-legal/index.html',
    actual: scriptSrcs('aviso-legal/index.html').length,
    max: 2,
  },
  {
    name: 'páginas editoriales sin comercio: sin cart-store en carga inicial',
    htmlPath: 'aviso-legal/index.html',
    actual: scriptSrcs('aviso-legal/index.html').some((src) => src.includes('cart-store')) ? 1 : 0,
    max: 0,
  },
  {
    name: 'blog índice: sin GSAP en carga inicial',
    htmlPath: 'blog/index.html',
    actual: scriptSrcs('blog/index.html').some((src) => src.includes('gsap')) ? 1 : 0,
    max: 0,
  },
  {
    name: 'home: GSAP diferido (no en entry scripts)',
    htmlPath: 'index.html',
    actual: scriptSrcs('index.html').some((src) => src.includes('gsap')) ? 1 : 0,
    max: 0,
  },
  {
    name: 'ficha de producto: payload de variantes',
    actual: maxVariantJsonBytes().maxBytes,
    max: 16_000,
  },
  {
    name: 'ficha de producto: JS inicial recursivo',
    htmlPath: productPage.htmlPath,
    actual: productPage.jsBytes,
    max: 90_000,
  },
  {
    name: 'ficha de producto: peticiones de script iniciales',
    htmlPath: productPage.htmlPath,
    actual: productPage.scriptRequests,
    max: 4,
  },
  {
    name: 'página legal: CSS enlazado',
    htmlPath: 'aviso-legal/index.html',
    actual: linkedCssBytes('aviso-legal/index.html'),
    max: 160_000,
  },
];

const gsapChunks = listAssets('.js').filter((asset) => asset.includes('gsap'));
const failures = budgets.filter((budget) => budget.actual > budget.max);

for (const budget of budgets) {
  const status = budget.actual <= budget.max ? 'ok' : 'FAIL';
  console.log(
    `[${status}] ${budget.name}: ${budget.actual.toLocaleString('es-ES')} / ${budget.max.toLocaleString('es-ES')}`
  );
}

console.log(`Chunks GSAP generados: ${gsapChunks.length}`);
if (gsapChunks.length > 0) {
  console.log(`  ${gsapChunks.join(', ')}`);
}

const variantBudget = maxVariantJsonBytes();
if (variantBudget.largestHandle) {
  console.log(`Mayor payload de variantes: ${variantBudget.largestHandle} (${variantBudget.maxBytes} bytes)`);
}
if (productPage.htmlPath) {
  console.log(`Mayor JS inicial de ficha: ${productPage.htmlPath} (${productPage.jsBytes} bytes)`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} presupuesto(s) de rendimiento superado(s).`);
  process.exit(1);
}

console.log('\nPresupuestos de rendimiento dentro de límites.');
