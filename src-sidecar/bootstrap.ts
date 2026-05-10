import express from 'express';
import db from '../lib/db';
import { configureGeminiCliRuntime } from '../lib/gemini-cli-runtime';

function parseJsonColumn(value: unknown, fallback: unknown = undefined) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function startMissingCliServer(error: unknown) {
  const app = express();
  const port = process.env.SIDECAR_PORT || 14321;
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
      const sessions = db.prepare(`
        SELECT
          s.*,
          COUNT(m.id) AS message_count
        FROM sessions s
        LEFT JOIN messages m ON m.session_id = s.id
        WHERE s.workspace IS NOT NULL AND trim(s.workspace) <> ''
        GROUP BY s.id
        ORDER BY s.updated_at DESC
      `).all();

      res.json(sessions);
    } catch (routeError) {
      console.error('[Sidecar] Failed to fetch degraded sessions:', routeError);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  app.post('/api/sessions', (req, res) => {
    try {
      const workspace = typeof req.body?.workspace === 'string' ? req.body.workspace.trim() : '';
      const title = typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : 'New Chat';

      if (!workspace) {
        res.status(400).json({ error: 'workspace is required' });
        return;
      }

      const id = crypto.randomUUID();
      const now = Date.now();
      db.prepare(`
        INSERT INTO sessions (id, title, created_at, updated_at, workspace, branch)
        VALUES (?, ?, ?, ?, ?, NULL)
      `).run(id, title, now, now, workspace);

      res.json({ id, title, created_at: now, updated_at: now, workspace, branch: null });
    } catch (routeError) {
      console.error('[Sidecar] Failed to create degraded session:', routeError);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  app.get('/api/sessions/latest-stats', (_req, res) => {
    res.json({ totalTokens: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, cost: 0, count: 0 });
  });

  app.get('/api/sessions/core', (_req, res) => {
    res.status(503).json({
      error: message,
      degraded: true,
      install: 'Install and authenticate the Gemini CLI on this machine, then relaunch GGBond.',
    });
  });

  app.get('/api/sessions/:id', (req, res) => {
    try {
      const { id } = req.params;
      const session = db
        .prepare("SELECT * FROM sessions WHERE id = ? AND workspace IS NOT NULL AND trim(workspace) <> ''")
        .get(id);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const messages = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC').all(id);
      const parsedMessages = messages.map((msg: any) => ({
        ...msg,
        stats: parseJsonColumn(msg.stats),
        thought: typeof msg.thought === 'string' ? msg.thought : undefined,
        citations: parseJsonColumn(msg.citations),
        images: parseJsonColumn(msg.images),
        parent_id: msg.parent_id,
        parentId: msg.parent_id === null || msg.parent_id === undefined ? null : String(msg.parent_id),
        id: msg.id === null || msg.id === undefined ? undefined : String(msg.id),
      }));

      res.json({ session, messages: parsedMessages });
    } catch (routeError) {
      console.error('[Sidecar] Failed to fetch degraded session:', routeError);
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  });

  app.delete('/api/sessions/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
      res.json({ success: true });
    } catch (routeError) {
      console.error('[Sidecar] Failed to delete degraded session:', routeError);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  });

  app.patch('/api/sessions/:id/archive', (req, res) => {
    try {
      const { id } = req.params;
      const { archived } = req.body ?? {};

      if (typeof archived !== 'boolean') {
        res.status(400).json({ error: 'Invalid archived value' });
        return;
      }

      db.prepare('UPDATE sessions SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id);
      res.json({ success: true, archived });
    } catch (routeError) {
      console.error('[Sidecar] Failed to archive degraded session:', routeError);
      res.status(500).json({ error: 'Failed to archive session' });
    }
  });

  app.patch('/api/sessions/:id/branch', (req, res) => {
    try {
      const { id } = req.params;
      const branch = typeof req.body?.branch === 'string' ? req.body.branch : null;
      const result = db
        .prepare('UPDATE sessions SET branch = ?, updated_at = ? WHERE id = ?')
        .run(branch, Date.now(), id);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({ success: true, branch });
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
