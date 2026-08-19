import { createShopifyStorefrontGateway } from '../src/commerce/infrastructure/shopify/storefront-gateway.ts';
import { SHOPIFY_STOREFRONT_API_VERSION } from '../src/commerce/infrastructure/shopify/config.ts';

// Comprobación ligera de conectividad Storefront. No sustituye a shopify:preflight.

if (process.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN) {
  console.error(
    'Shopify Storefront smoke test failed: PUBLIC_SHOPIFY_STOREFRONT_TOKEN is not used. Use SHOPIFY_STOREFRONT_PRIVATE_TOKEN only.'
  );
  process.exit(1);
}

const query = `
  query StorefrontConnection {
    shop {
      name
    }
  }
`;

try {
  const storefront = createShopifyStorefrontGateway({
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
    apiVersion: process.env.SHOPIFY_API_VERSION || SHOPIFY_STOREFRONT_API_VERSION,
    storefrontToken: process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
  });
  const data = await storefront.graphql(query);

  if (!data || typeof data !== 'object' || !data.shop || typeof data.shop.name !== 'string') {
    throw new Error('Shopify Storefront connection succeeded but returned an unexpected shop payload.');
  }

  console.log(`Shopify Storefront connection succeeded for shop: ${data.shop.name}`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown Shopify Storefront error.';
  console.error(`Shopify Storefront smoke test failed: ${message}`);
  process.exitCode = 1;
}
