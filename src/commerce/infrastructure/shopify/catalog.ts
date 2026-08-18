import { publicSecurityConfig } from '@config/security';
import { fetchShopifyCatalog } from './catalog-query';
import { mapShopifyCatalog } from './catalog-mappers';
import { createConfiguredShopifyStorefrontGateway } from './storefront';

export const loadConfiguredShopifyCatalog = async () => {
  const gateway = createConfiguredShopifyStorefrontGateway();
  const payload = await fetchShopifyCatalog(gateway);
  return mapShopifyCatalog(payload, publicSecurityConfig.remoteImageHosts);
};
