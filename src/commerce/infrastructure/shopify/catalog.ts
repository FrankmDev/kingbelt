import { publicSecurityConfig } from '@config/security';
import { fetchShopifyCatalog } from './catalog-query';
import { mapShopifyCatalog } from './catalog-mappers';
import { createConfiguredShopifyStorefrontGateway } from './storefront';
import type { ShopifyStorefrontGateway } from './storefront-gateway';

let catalogGateway: ShopifyStorefrontGateway | undefined;

export const loadConfiguredShopifyCatalog = async () => {
  catalogGateway ??= createConfiguredShopifyStorefrontGateway();
  const payload = await fetchShopifyCatalog(catalogGateway);
  return mapShopifyCatalog(payload, publicSecurityConfig.remoteImageHosts);
};
