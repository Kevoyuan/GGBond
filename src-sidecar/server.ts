import express from 'express';
import cors from 'cors';
import { CoreService } from '../lib/core-service';
import { registerAutoRoutes } from './auto-routes';
import { resolveDefaultWorkspaceRoot } from '../lib/runtime-home';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', engine: 'ggbond-sidecar' });
});

// Route the API surface through the legacy handlers so the sidecar stays thin
// and aligned with the gemini-cli-core adapter logic in one place.
registerAutoRoutes(app);

// Keep cancel as an explicit sidecar endpoint until legacy-api exposes it.
app.post('/api/chat/cancel', async (req, res) => {
    try {
        const { sessionId } = req.body;
        const core = CoreService.getInstance() as CoreService & {
            cancelCurrentTurn?: (sessionId?: string) => void;
            clearConfirmationSubscribers?: () => void;
        };
        core.cancelCurrentTurn?.(sessionId);
        core.clearConfirmationSubscribers?.();
        res.json({ success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});

const port = process.env.SIDECAR_PORT || 14321;

async function prewarmCoreService() {
    if (process.env.GGBOND_PREWARM === 'false') {
        console.log('[Sidecar] Core prewarm disabled via GGBOND_PREWARM=false');
        return;
    }

    const startedAt = performance.now();
    const model = process.env.GGBOND_PREWARM_MODEL || 'gemini-2.5-flash';
    const cwd = resolveDefaultWorkspaceRoot();
    const sessionId = process.env.GGBOND_PREWARM_SESSION_ID || '__ggbond_prewarm__';

    try {
        const core = CoreService.getInstance();
        await core.initialize({
            sessionId,
            model,
            cwd,
            approvalMode: 'safe',
            systemInstruction: '',
            modelSettings: {
                maxRetries: 1,
            },
        });
        const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
        console.log(`[Sidecar] Core prewarm ready in ${elapsedMs}ms`, { model, cwd, sessionId });
    } catch (error) {
        console.warn('[Sidecar] Core prewarm failed:', error);
    }
}

app.listen(port, () => {
    console.log(`[Sidecar] Gemini CLI Core HTTP Server running on port ${port}`);
    void prewarmCoreService();
});
