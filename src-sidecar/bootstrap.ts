import express from 'express';
import { configureGeminiCliRuntime } from '../lib/gemini-cli-runtime';
import { buildUnsupportedProviderMessage, isGeminiCoreModel } from '../lib/provider-registry';
import { SIDECAR_DEFAULT_PORT } from '../lib/sidecar-port';
import {
  listSessions,
  createSession,
  getSession,
  deleteSession,
  archiveSession,
  updateSessionBranch,
  getLatestStats,
} from '../lib/session-crud';

function startMissingCliServer(error: unknown) {
  const app = express();
  const port = process.env.SIDECAR_PORT || SIDECAR_DEFAULT_PORT;
  const message = error instanceof Error ? error.message : 'Gemini CLI runtime is unavailable.';

  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'degraded',
      engine: 'ggbond-sidecar',
      error: message,
      capabilities: {
        database: true,
        geminiCore: false,
      },
    });
  });

  app.get('/api/sessions', (_req, res) => {
    try {
      res.json(listSessions());
    } catch (routeError) {
      console.error('[Sidecar] Failed to fetch degraded sessions:', routeError);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  app.post('/api/sessions', (req, res) => {
    try {
      const workspace = typeof req.body?.workspace === 'string' ? req.body.workspace : '';
      const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
      const result = createSession(workspace, title);
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (routeError) {
      console.error('[Sidecar] Failed to create degraded session:', routeError);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  app.get('/api/sessions/latest-stats', (_req, res) => {
    res.json(getLatestStats());
  });

  app.get('/api/sessions/core', (_req, res) => {
    res.status(503).json({
      error: message,
      degraded: true,
      install: 'Install and authenticate the Gemini CLI on this machine, then relaunch GGBond.',
    });
  });

  app.post('/api/chat', (req, res) => {
    const model = typeof req.body?.model === 'string' ? req.body.model : '';
    if (model && !isGeminiCoreModel(model)) {
      res.status(501).json({
        error: buildUnsupportedProviderMessage(model),
        providerReady: false,
        model,
      });
      return;
    }

    res.status(503).json({
      error: message,
      degraded: true,
      install: 'Install and authenticate the Gemini CLI on this machine, then relaunch GGBond.',
    });
  });

  app.get('/api/sessions/:id', (req, res) => {
    try {
      const result = getSession(req.params.id);
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (routeError) {
      console.error('[Sidecar] Failed to fetch degraded session:', routeError);
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  });

  app.delete('/api/sessions/:id', (req, res) => {
    try {
      res.json(deleteSession(req.params.id));
    } catch (routeError) {
      console.error('[Sidecar] Failed to delete degraded session:', routeError);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  });

  app.patch('/api/sessions/:id/archive', (req, res) => {
    try {
      const { archived } = req.body ?? {};
      const result = archiveSession(req.params.id, archived);
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (routeError) {
      console.error('[Sidecar] Failed to archive degraded session:', routeError);
      res.status(500).json({ error: 'Failed to archive session' });
    }
  });

  app.patch('/api/sessions/:id/branch', (req, res) => {
    try {
      const branch = typeof req.body?.branch === 'string' ? req.body.branch : null;
      const result = updateSessionBranch(req.params.id, branch);
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (routeError) {
      console.error('[Sidecar] Failed to update degraded session branch:', routeError);
      res.status(500).json({ error: 'Failed to update session branch' });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(503).json({
      error: message,
      degraded: true,
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
