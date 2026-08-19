import type { SessionDriverConfig } from 'astro';
import fsLiteDriver from 'unstorage/drivers/fs-lite';
import upstashDriver from 'unstorage/drivers/upstash';

/** Cookie opaca de sesión. El prefijo `__Host-` exige Secure, Path=/ y ausencia de Domain. */
export const SESSION_COOKIE_NAME = '__Host-kingbelt-session';

/** 30 días: coherente con la vida útil esperada de un carrito Shopify inactivo. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const SESSION_STORE_PREFIX = 'kingbelt-session';
const LOCAL_SESSION_PATH = '.astro/session';

export const sessionDriverConfig = {
  entrypoint: new URL(import.meta.url),
} satisfies SessionDriverConfig;

const readUpstashCredentials = (): { url: string; token: string } | undefined => {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? '';
  if (!url || !token) return undefined;
  return { url, token };
};

/**
 * Store persistente compartido entre invocaciones serverless.
 * Devuelve el driver Unstorage completo: Astro lo envuelve con `createStorage`.
 * En Vercel exige Redis/KV (Upstash REST). En local usa disco, nunca memoria de proceso.
 */
export default function createSessionDriver() {
  const upstash = readUpstashCredentials();
  if (upstash) {
    return upstashDriver({
      ...upstash,
      base: SESSION_STORE_PREFIX,
      ttl: SESSION_TTL_SECONDS,
    });
  }

  if (process.env.VERCEL) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for session storage on Vercel.'
    );
  }

  return fsLiteDriver({ base: LOCAL_SESSION_PATH });
}
