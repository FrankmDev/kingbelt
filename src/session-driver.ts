import type { SessionDriverConfig } from 'astro';
import fsLiteDriver from 'unstorage/drivers/fs-lite';
import upstashDriver from 'unstorage/drivers/upstash';
import {
  LOCAL_SESSION_PATH,
  SESSION_STORE_PREFIX,
  SESSION_TTL_SECONDS,
  resolveUpstashSessionCredentials,
} from './session-storage-config';

/** Cookie opaca de sesión. El prefijo `__Host-` exige Secure, Path=/ y ausencia de Domain. */
export const SESSION_COOKIE_NAME = '__Host-kingbelt-session';

export { SESSION_STORE_PREFIX, SESSION_TTL_SECONDS };

export const sessionDriverConfig = {
  entrypoint: new URL(import.meta.url),
} satisfies SessionDriverConfig;

/**
 * Store persistente compartido entre invocaciones serverless.
 * Devuelve el driver Unstorage completo: Astro lo envuelve con `createStorage`.
 * En Vercel exige Redis/KV (Upstash REST). En local, sin credenciales, usa disco.
 */
export default function createSessionDriver() {
  const upstash = resolveUpstashSessionCredentials(process.env);
  if (upstash) {
    return upstashDriver({
      url: upstash.url,
      token: upstash.token,
      base: SESSION_STORE_PREFIX,
      ttl: SESSION_TTL_SECONDS,
    });
  }

  return fsLiteDriver({ base: LOCAL_SESSION_PATH });
}
