import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export interface BrowserTraceItem {
    id: string;
    timestamp: number;
    action: string;
    url: string;
    status: 'success' | 'failure' | 'timeout';
    durationMs: number;
}

export async function GET() {
    try {
        const tracesPath = join(homedir(), '.gemini', 'browser-traces.json');
        const content = await readFile(tracesPath, 'utf-8');
        const raw = JSON.parse(content);
        const traces = Array.isArray(raw) ? raw.slice(0, 30) : [];
        return NextResponse.json(traces as BrowserTraceItem[]);
    } catch {
        // No trace file = return empty list, not an error
        return NextResponse.json([] as BrowserTraceItem[]);
    }
}
