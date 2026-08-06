/**
 * Configuración pública y no secreta. Cada alta de host debe corresponder a un
 * recurso realmente usado y revisarse junto con CSP y las pruebas de seguridad.
 */
export const publicSecurityConfig = {
  remoteImageHosts: ['images.unsplash.com'],
} as const;
