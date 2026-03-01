import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

export interface BrowserStatusView {
    available: boolean;
    executableSource: 'env' | 'config' | 'default' | 'none';
    executablePath: string;
    successRate: number;
    avgLatencyMs: number;
    persistenceEnabled: boolean;
    contextDirSize: number; // bytes
    lastCleanup: string | null;
}

async function readJson(path: string): Promise<unknown> {
    try {
        const content = await readFile(path, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

async function getDirSize(dir: string): Promise<number> {
    try {
        const s = await stat(dir);
        return s.size;
    } catch {
        return 0;
    }
}

export async function GET() {
    try {
        const globalSettings = await readJson(join(homedir(), '.gemini', 'settings.json'));
        const workspaceSettings = await readJson(join(process.cwd(), '.gemini', 'settings.json'));
        const browserTelemetry = await readJson(join(process.cwd(), '.gemini', 'browser-telemetry.json'));

        const g = (globalSettings as Record<string, unknown>) ?? {};
        const w = (workspaceSettings as Record<string, unknown>) ?? {};
        const bt = (browserTelemetry as Record<string, unknown>) ?? {};

        // Determine executable source
        const envExecutable = process.env.BROWSER_EXECUTABLE_PATH ?? process.env.CHROME_PATH ?? '';
        const configExecutable = ((w.browserExecutablePath ?? g.browserExecutablePath) as string) ?? '';
        let executableSource: BrowserStatusView['executableSource'] = 'none';
        let executablePath = '';

        if (envExecutable) {
            executableSource = 'env';
            executablePath = envExecutable;
        } else if (configExecutable) {
            executableSource = 'config';
            executablePath = configExecutable;
        } else {
            // Check default Chrome/Chromium paths
            const defaultPaths = [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
            ];
            const found = defaultPaths.find(p => existsSync(p));
            if (found) {
                executableSource = 'default';
                executablePath = found;
            }
        }

        const available = executableSource !== 'none';
        const persistenceEnabled = Boolean(w.browserContextPersistence ?? g.browserContextPersistence ?? false);

        const contextDir = join(homedir(), '.gemini', 'browser-context');
        const contextDirSize = await getDirSize(contextDir);

        const successRate = Number(bt.success_rate ?? (available ? 100 : 0));
        const avgLatencyMs = Number(bt.avg_latency_ms ?? 0);
        const lastCleanup = (bt.last_cleanup as string) ?? null;

        const data: BrowserStatusView = {
            available,
            executableSource,
            executablePath,
            successRate,
            avgLatencyMs,
            persistenceEnabled,
            contextDirSize,
            lastCleanup,
        };

        return NextResponse.json(data);
    } catch (err) {
        console.error('[browser/status]', err);
        return NextResponse.json({
            available: false,
            executableSource: 'none',
            executablePath: '',
            successRate: 0,
            avgLatencyMs: 0,
            persistenceEnabled: false,
            contextDirSize: 0,
            lastCleanup: null,
        } as BrowserStatusView);
    }
}
