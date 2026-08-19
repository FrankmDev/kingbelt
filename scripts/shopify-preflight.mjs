import { runShopifyPreflightCli } from './shopify-preflight.ts';

process.exitCode = await runShopifyPreflightCli();
