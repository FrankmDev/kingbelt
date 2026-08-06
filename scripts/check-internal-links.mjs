import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const distRoot = resolve('dist');
const localOrigin = 'https://kingbelt.local';
const ignoredSchemes = /^(?:mailto:|tel:|javascript:|data:)/i;

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path);
  }
  return files;
};

const routeCandidates = (pathname) => {
  const cleanPath = pathname.replace(/^\/+/, '').replace(/\/$/, '');
  if (!cleanPath) return [join(distRoot, 'index.html')];
  return [
    join(distRoot, `${cleanPath}.html`),
    join(distRoot, cleanPath, 'index.html'),
    join(distRoot, cleanPath),
  ];
};

const resolveTarget = async (pathname) => {
  for (const candidate of routeCandidates(pathname)) {
    try {
      const details = await stat(candidate);
      if (details.isFile()) return candidate;
    } catch {
      // Keep checking the remaining output conventions.
    }
  }
  return null;
};

const getSourcePathname = (sourceFile) => {
  const outputPath = relative(distRoot, sourceFile).split(sep).join('/');
  if (outputPath === 'index.html') return '/';
  if (outputPath.endsWith('/index.html')) return `/${outputPath.slice(0, -'index.html'.length)}`;
  return `/${outputPath}`;
};

const decodeHash = (hash) => {
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
};

const htmlFiles = await walk(distRoot);
const htmlCache = new Map();
const targetCache = new Map();
const missing = [];
let checked = 0;

const readHtml = async (file) => {
  if (!htmlCache.has(file)) htmlCache.set(file, readFile(file, 'utf8'));
  return htmlCache.get(file);
};

const getTarget = async (pathname) => {
  if (!targetCache.has(pathname)) targetCache.set(pathname, resolveTarget(pathname));
  return targetCache.get(pathname);
};

for (const sourceFile of htmlFiles) {
  const html = await readHtml(sourceFile);
  const sourceUrl = new URL(getSourcePathname(sourceFile), localOrigin);
  const hrefs = html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi);
  for (const match of hrefs) {
    const rawHref = match[1].trim();
    if (!rawHref || ignoredSchemes.test(rawHref)) continue;

    const targetUrl = new URL(rawHref, sourceUrl);
    if (targetUrl.origin !== localOrigin) continue;

    checked += 1;
    const target = await getTarget(targetUrl.pathname);
    if (!target) {
      missing.push({ sourceFile, href: rawHref, reason: 'target not found' });
      continue;
    }
    if (targetUrl.hash && target.endsWith('.html')) {
      const hash = decodeHash(targetUrl.hash.slice(1));
      const targetHtml = await readHtml(target);
      const escapedHash = hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const idPattern = new RegExp(`(?:id|name)=["']${escapedHash}["']`, 'i');
      if (!idPattern.test(targetHtml)) {
        missing.push({ sourceFile, href: rawHref, reason: `anchor #${hash} not found` });
      }
    }
  }
}

if (missing.length) {
  console.error(`Internal link check failed: ${missing.length} invalid link(s).`);
  for (const item of missing) {
    console.error(`- ${relative(process.cwd(), item.sourceFile)} → ${item.href} (${item.reason})`);
  }
  process.exit(1);
}

console.log(`Internal link check passed: ${checked} local link(s) verified.`);
