import express from 'express';
import { configureGeminiCliRuntime } from '../lib/gemini-cli-runtime';

function startMissingCliServer(error: unknown) {
  const app = express();
  const port = process.env.SIDECAR_PORT || 14321;
  const message = error instanceof Error ? error.message : 'Gemini CLI runtime is unavailable.';

  app.get('/api/health', (_req, res) => {
    res.status(503).json({
      status: 'error',
      engine: 'ggbond-sidecar',
      error: message,
    });
  });

  app.use('/api', (_req, res) => {
    res.status(503).json({
      error: message,
      install: 'Install and authenticate the Gemini CLI on this machine, then relaunch GGBond.',
    });
  });

  app.listen(port, () => {
    console.error(`[Sidecar] ${message}`);
    console.error(`[Sidecar] Fallback server listening on port ${port}`);
  });
}

try {
  const runtime = configureGeminiCliRuntime();
  console.log(`[Sidecar] Using Gemini CLI at ${runtime.executablePath}`);
  console.log(`[Sidecar] Using gemini-cli-core from ${runtime.corePackageJsonPath}`);
  require('./server');
} catch (error) {
  console.error('[Sidecar] Failed to start main server:', error);
  startMissingCliServer(error);
}
