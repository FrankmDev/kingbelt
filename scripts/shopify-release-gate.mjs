import { runReleaseGateCli } from './shopify-release-gate.ts';

process.exitCode = await runReleaseGateCli();
