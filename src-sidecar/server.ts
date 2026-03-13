import express from 'express';
import cors from 'cors';
import { CoreService } from '../lib/core-service';
import { registerAutoRoutes } from './auto-routes';

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
        const core = CoreService.getInstance();
        (core as any).cancelCurrentTurn?.(sessionId);
        (core as any).clearConfirmationSubscribers?.();
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

const port = process.env.SIDECAR_PORT || 14321;
app.listen(port, () => {
    console.log(`[Sidecar] Gemini CLI Core HTTP Server running on port ${port}`);
});
