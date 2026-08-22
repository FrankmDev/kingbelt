/**
 * Los deployments de Preview/Development de Vercel no deben indexarse.
 * Producción y el entorno local (sin `VERCEL_ENV`) conservan la política de la página.
 */
export const isSearchIndexableDeployment = (): boolean => {
  const vercelEnv = process.env.VERCEL_ENV;
  return vercelEnv !== 'preview' && vercelEnv !== 'development';
};

/** Combina robots de página con la política del deployment. */
export const resolveIndexRobots = (pageRobots?: string): string => {
  if (!isSearchIndexableDeployment()) return 'noindex,nofollow';
  return pageRobots ?? 'index,follow';
};
