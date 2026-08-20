import { runSessionPreflightCli } from './session-preflight.ts';

process.exitCode = await runSessionPreflightCli();
