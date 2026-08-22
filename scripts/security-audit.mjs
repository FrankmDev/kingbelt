import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { findCredentialAssignment } from './security-patterns.mjs';

const root = resolve(import.meta.dirname, '..');
const includeHistory = process.argv.includes('--history');
const MAX_SCANNED_FILE_BYTES = 2_000_000;

const normalizePath = (path) => relative(root, path).split(sep).join('/');
const git = (args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 100 * 1024 * 1024,
});

const candidatePaths = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  .split('\0')
  .filter(Boolean)
  .map((path) => join(root, path));

const forbiddenTrackedPath = (path) => {
  const name = basename(path).toLowerCase();
  if (name === '.env.example') return false;
  return (
    name === '.env' ||
    name.startsWith('.env.') ||
    /\.(?:pem|key|p12|pfx|jks)$/.test(name) ||
    name === 'credentials.json' ||
    /^service-account.*\.json$/.test(name)
  );
};

const tokenRules = [
  ['private_key', new RegExp(['-----BEGIN', '(?:RSA |EC |OPENSSH )?PRIVATE KEY-----'].join(' '))],
  ['github_token', /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/],
  ['shopify_private_token', /\b(?:shpat|shpca|shpss)_[A-Za-z0-9]{20,}\b/],
  ['aws_access_key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['slack_token', /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/],
  ['stripe_secret', /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ['google_api_key', /\bAIza[A-Za-z0-9_-]{30,}\b/],
];

const publicPrivateName = /\bPUBLIC_[A-Z0-9_]*(?:PRIVATE|SECRET|PASSWORD|ADMIN)[A-Z0-9_]*\b/;
const privateBrowserName = /\b(?:SHOPIFY_[A-Z0-9_]*PRIVATE[A-Z0-9_]*|ADMIN_API_[A-Z0-9_]*)\b/;
const clientPathPattern = /^src\/(?:components|layouts|pages\/(?!api\/)|scripts|shared\/browser)\//;
const browserCompositionRoots = new Set(['src/commerce/cart.ts']);
const clientLogPattern = /\bconsole\.(?:debug|info|log|warn|error)\s*\(/;

const findings = [];
const report = (path, rule) => findings.push({ path, rule });

const scanText = (text, path, { generic = true } = {}) => {
  tokenRules.forEach(([rule, pattern]) => {
    if (pattern.test(text)) report(path, rule);
  });
  if (generic) {
    if (findCredentialAssignment(text)) report(path, 'credential_assignment');
  }
  if (publicPrivateName.test(text)) report(path, 'private_name_with_public_prefix');
};

candidatePaths.forEach((path) => {
  const normalized = normalizePath(path);
  if (forbiddenTrackedPath(path) && git(['ls-files', '--error-unmatch', normalized]).trim()) {
    report(normalized, 'tracked_credential_file');
  }
  if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size > MAX_SCANNED_FILE_BYTES) return;
  const buffer = readFileSync(path);
  if (buffer.includes(0)) return;
  const text = buffer.toString('utf8');
  scanText(text, normalized, { generic: normalized !== 'scripts/security-audit.mjs' });

  if (clientPathPattern.test(normalized) || browserCompositionRoots.has(normalized)) {
    if (text.includes('astro:env/server') || privateBrowserName.test(text)) {
      report(normalized, 'private_env_in_browser_surface');
    }
    if (clientPathPattern.test(normalized) && clientLogPattern.test(text)) {
      report(normalized, 'browser_console_log');
    }
  }
});

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});

const dist = join(root, 'dist');
try {
  walk(dist).forEach((path) => {
    if (statSync(path).size > MAX_SCANNED_FILE_BYTES) return;
    const buffer = readFileSync(path);
    if (buffer.includes(0)) return;
    const text = buffer.toString('utf8');
    tokenRules.forEach(([rule, pattern]) => {
      if (pattern.test(text)) report(normalizePath(path), `built_${rule}`);
    });
    if (privateBrowserName.test(text)) report(normalizePath(path), 'private_name_in_build');
    if (path.endsWith('.html')) {
      for (const match of text.matchAll(/<script\b([^>]*)>/gi)) {
        const attributes = match[1];
        const inertJson = /\btype=["']application\/(?:ld\+)?json["']/i.test(attributes);
        if (!/\bsrc=["'][^"']+["']/i.test(attributes) && !inertJson) {
          report(normalizePath(path), 'inline_executable_script');
        }
      }
      if (/<form\b[^>]*\baction=["']https?:\/\//i.test(text)) {
        report(normalizePath(path), 'external_form_action');
      }
    }
  });
} catch {
  // `dist` no existe antes del primer build; el escaneo de fuentes sigue siendo válido.
}

if (includeHistory) {
  const shallow = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
  if (shallow) {
    console.error('Security history scan requires a full Git history. Re-run with fetch-depth: 0.');
    process.exit(1);
  }

  const history = git(['log', '--all', '--reflog', '-p', '--no-ext-diff', '--no-color']);
  tokenRules.forEach(([rule, pattern]) => {
    if (pattern.test(history)) report('[git history]', rule);
  });
  if (findCredentialAssignment(history)) {
    report('[git history]', 'credential_assignment');
  }
}

const vercelConfigPath = join(root, 'vercel.json');
if (existsSync(vercelConfigPath)) {
  const vercelText = readFileSync(vercelConfigPath, 'utf8');
  if (/\bCOMMERCE_SOURCE\b/.test(vercelText)) {
    report('vercel.json', 'commerce_source_in_vercel_config');
  }
  if (/"build"\s*:\s*\{[^}]*"env"/.test(vercelText) || /\bbuild\.env\b/.test(vercelText)) {
    report('vercel.json', 'build_env_in_vercel_config');
  }
  if (
    /\b(?:SHOPIFY_STOREFRONT_PRIVATE_TOKEN|SHOPIFY_WEBHOOK_SECRET|VERCEL_DEPLOY_HOOK_URL|UPSTASH_REDIS_REST_TOKEN)\b/.test(
      vercelText
    )
  ) {
    report('vercel.json', 'secret_in_vercel_config');
  }
}

const uniqueFindings = [...new Map(
  findings.map((finding) => [`${finding.path}\0${finding.rule}`, finding])
).values()];

if (uniqueFindings.length) {
  console.error(`Security scan failed: ${uniqueFindings.length} finding(s). Values are intentionally redacted.`);
  uniqueFindings.forEach(({ path, rule }) => console.error(`- ${path}: ${rule}`));
  process.exitCode = 1;
} else {
  console.log(`Security scan passed (${candidatePaths.length} files${includeHistory ? ' + Git history' : ''}).`);
}
