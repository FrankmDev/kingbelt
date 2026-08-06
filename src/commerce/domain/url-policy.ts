const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export const MAX_EXTERNAL_URL_LENGTH = 2_048;

export const isSafeInternalPath = (value: string): boolean => {
  if (
    !value ||
    value.length > MAX_EXTERNAL_URL_LENGTH ||
    value !== value.trim() ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return false;
  }

  try {
    const base = new URL('https://kingbelt.invalid');
    return new URL(value, base).origin === base.origin;
  } catch {
    return false;
  }
};

export const normalizeExactHostname = (value: string): string | null => {
  const hostname = value.trim().toLowerCase();
  if (
    !hostname ||
    hostname !== value.toLowerCase() ||
    hostname.includes('*') ||
    hostname.includes('/') ||
    hostname.includes(':') ||
    hostname.startsWith('.') ||
    hostname.endsWith('.') ||
    !HOSTNAME_PATTERN.test(hostname)
  ) {
    return null;
  }
  return hostname;
};

/**
 * Acepta rutas raíz del sitio o HTTPS hacia un host aprobado de forma exacta.
 * No admite credenciales, puertos alternativos, comodines ni URLs relativas al
 * documento, para que la misma política funcione en build y en navegador.
 */
export const isAllowedImageUrl = (
  value: string,
  allowedRemoteHosts: readonly string[]
): boolean => {
  if (
    !value ||
    value.length > MAX_EXTERNAL_URL_LENGTH ||
    value !== value.trim() ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    value.includes('\\')
  ) {
    return false;
  }

  if (value.startsWith('/')) return !value.startsWith('//');

  try {
    const url = new URL(value);
    const allowed = new Set(
      allowedRemoteHosts
        .map(normalizeExactHostname)
        .filter((host): host is string => host !== null)
    );
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      allowed.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
};
