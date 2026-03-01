import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { resolveGeminiConfigDir, resolveRuntimeHome } from '@/lib/runtime-home';

export interface BrowserTraceItem {
    id: string;
    timestamp: number;
    action: string;
    url: string;
    status: 'success' | 'failure' | 'timeout';
    durationMs: number;
}

const BROWSER_TRACES_CACHE_TTL_MS = 3000;
let browserTracesCache: { data: BrowserTraceItem[]; expiresAt: number } | null = null;
let browserTracesInFlight: Promise<BrowserTraceItem[]> | null = null;

export async function GET() {
    try {
        const now = Date.now();
        if (browserTracesCache && browserTracesCache.expiresAt > now) {
            return NextResponse.json(browserTracesCache.data);
        }
        if (browserTracesInFlight) {
            const data = await browserTracesInFlight;
            return NextResponse.json(data);
        }

        browserTracesInFlight = (async () => {
        const runtimeConfigDir = resolveGeminiConfigDir(resolveRuntimeHome());
        const tracesPath = join(runtimeConfigDir, 'browser-traces.json');
        const content = await readFile(tracesPath, 'utf-8');
        const raw = JSON.parse(content);
        const traces = Array.isArray(raw) ? raw.slice(0, 30) : [];
            const data = traces as BrowserTraceItem[];
            browserTracesCache = { data, expiresAt: Date.now() + BROWSER_TRACES_CACHE_TTL_MS };
            return data;
        })().finally(() => {
            browserTracesInFlight = null;
        });

        const data = await browserTracesInFlight;
        return NextResponse.json(data);
    } catch {
        // No trace file = return empty list, not an error
        return NextResponse.json([] as BrowserTraceItem[]);
    }
}
