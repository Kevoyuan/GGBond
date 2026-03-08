import { NextResponse } from 'next/server';
import { getModelConfig } from '@/lib/gemini-service';

// Cache + in-flight dedup to avoid repeated cold-start computation
const MODELS_CACHE_TTL_MS = 10_000;
let modelsCache: { data: unknown; expiresAt: number } | null = null;
let modelsInFlight: Promise<NextResponse> | null = null;

export async function GET() {
    const now = Date.now();
    if (modelsCache && modelsCache.expiresAt > now) {
        return NextResponse.json(modelsCache.data);
    }
    if (modelsInFlight) return modelsInFlight;

    modelsInFlight = (async () => {
        try {
            const config = await getModelConfig();
            modelsCache = { data: config, expiresAt: Date.now() + MODELS_CACHE_TTL_MS };
            return NextResponse.json(config);
        } catch (error) {
            console.error('Failed to read model config:', error);
            return NextResponse.json({ error: 'Failed to read model config' }, { status: 500 });
        } finally {
            modelsInFlight = null;
        }
    })();
    return modelsInFlight;
}
