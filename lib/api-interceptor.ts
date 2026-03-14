import { dbClient } from './db-client';
import { invoke } from '@tauri-apps/api/core';

let initialized = false;
let cachedSidecarPort: number | null = null;
let resolvingSidecarPort: Promise<number> | null = null;

// We need a helper to read JSON body
async function readBody(init?: RequestInit): Promise<any> {
    if (!init?.body) return {};
    if (typeof init.body === 'string') return JSON.parse(init.body);
    return {};
}

function jsonResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function canReachSidecar(port: number, originalFetch: typeof window.fetch) {
    try {
        const res = await originalFetch(`http://127.0.0.1:${port}/api/health`);
        return res.ok;
    } catch {
        return false;
    }
}

async function resolveSidecarPort(originalFetch: typeof window.fetch, forceRefresh = false) {
    if (!forceRefresh && cachedSidecarPort && await canReachSidecar(cachedSidecarPort, originalFetch)) {
        return cachedSidecarPort;
    }

    if (!forceRefresh && resolvingSidecarPort) {
        return resolvingSidecarPort;
    }

    resolvingSidecarPort = (async () => {
        const fallbackPorts = [cachedSidecarPort, 14321].filter((value): value is number => typeof value === 'number');

        for (let attempt = 0; attempt < 4; attempt += 1) {
            const invokedPort = await invoke<number>('get_sidecar_port').catch(() => null);
            const candidates = [invokedPort, ...fallbackPorts]
                .filter((value): value is number => typeof value === 'number' && value > 0)
                .filter((value, index, array) => array.indexOf(value) === index);

            for (const port of candidates) {
                if (await canReachSidecar(port, originalFetch)) {
                    cachedSidecarPort = port;
                    return port;
                }
            }

            await sleep(150 * (attempt + 1));
        }

        const finalPort = await invoke<number>('get_sidecar_port').catch(() => null);
        if (typeof finalPort === 'number' && finalPort > 0) {
            cachedSidecarPort = finalPort;
            return finalPort;
        }

        cachedSidecarPort = cachedSidecarPort ?? 14321;
        return cachedSidecarPort;
    })().finally(() => {
        resolvingSidecarPort = null;
    });

    return resolvingSidecarPort;
}

export function initApiInterceptor() {
    if (typeof window === 'undefined' || initialized) return;
    initialized = true;

    const originalFetch = window.fetch;

    window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');

        // If it's not starting with /api, pass through
        if (!url.startsWith('/api/') && !url.includes('localhost:3000/api/')) {
            return originalFetch(input, init);
        }

        // Normalize URL path
        const isAbsolute = url.startsWith('http');
        const parsedUrl = new URL(isAbsolute ? url : window.location.origin + url);
        const path = parsedUrl.pathname;
        const method = init?.method || 'GET';

        try {
            // ============================================
            // 1. CHAT (Sidecar OR React handling)
            // ============================================
            if (path.startsWith('/api/chat/status')) {
                const sidecarPort = await resolveSidecarPort(originalFetch);
                return originalFetch(`http://127.0.0.1:${sidecarPort}${path}${parsedUrl.search}`, init);
            }
            if (path.startsWith('/api/chat/cancel')) {
                const sidecarPort = await resolveSidecarPort(originalFetch);
                return originalFetch(`http://127.0.0.1:${sidecarPort}/api/chat/cancel`, init);
            }
            if (path === '/api/chat') {
                const sidecarPort = await resolveSidecarPort(originalFetch);
                return originalFetch(`http://127.0.0.1:${sidecarPort}/api/chat`, init);
            }
            if (path === '/api/confirm') {
                const sidecarPort = await resolveSidecarPort(originalFetch);
                return originalFetch(`http://127.0.0.1:${sidecarPort}/api/confirm`, init);
            }

            // ============================================
            // 2. SESSIONS (Sidecar - single source of truth)
            // ============================================
            if (path === '/api/sessions'
                || path === '/api/sessions/core'
                || path === '/api/sessions/latest-stats'
                || /\/api\/sessions\/[^/]+$/.test(path)
                || /\/api\/sessions\/[^/]+\/archive$/.test(path)
                || /\/api\/sessions\/[^/]+\/branch$/.test(path)) {
                const sidecarPort = await resolveSidecarPort(originalFetch);
                return originalFetch(`http://127.0.0.1:${sidecarPort}${path}${parsedUrl.search}`, init);
            }

            // ============================================
            // 3. CLIENT-SIDE FALLBACK STUBS
            // Only for endpoints whose responses must have a specific shape
            // to prevent component crashes. Other endpoints fall through to sidecar.
            // ============================================
            // ============================================
            // 4. CONFIG
            // ============================================
            if (path === '/api/config/geminiignore') {
                if (method === 'GET') return jsonResponse({ content: await dbClient.config.get('geminiignore') || '' });
                if (method === 'POST') {
                    const { content } = await readBody(init);
                    await dbClient.config.set('geminiignore', content);
                    return jsonResponse({ success: true });
                }
            }
            if (path === '/api/config/trusted-folders') {
                if (method === 'GET') {
                    const str = await dbClient.config.get('trusted-folders');
                    return jsonResponse({ folders: str ? JSON.parse(str) : [] });
                }
                if (method === 'POST') {
                    const { folders } = await readBody(init);
                    await dbClient.config.set('trusted-folders', JSON.stringify(folders));
                    return jsonResponse({ success: true });
                }
            }
            if (path === '/api/config/custom-commands') {
                if (method === 'GET') {
                    const str = await dbClient.config.get('custom-commands');
                    return jsonResponse({ commands: str ? JSON.parse(str) : [] });
                }
                if (method === 'POST') {
                    const { commands } = await readBody(init);
                    await dbClient.config.set('custom-commands', JSON.stringify(commands));
                    return jsonResponse({ success: true });
                }
            }

            // ============================================
            // 5. Proxy all remaining to Sidecar (skills, agents, models, mcp, git, etc.)
            // ============================================
            const sidecarPort = await resolveSidecarPort(originalFetch);
            try {
                return await originalFetch(`http://127.0.0.1:${sidecarPort}${path}${parsedUrl.search}`, init);
            } catch (proxyError) {
                cachedSidecarPort = null;
                try {
                    const retryPort = await resolveSidecarPort(originalFetch, true);
                    if (retryPort !== sidecarPort) {
                        return await originalFetch(`http://127.0.0.1:${retryPort}${path}${parsedUrl.search}`, init);
                    }
                } catch {
                    // Fall through to safe fallback below.
                }
                console.warn('[Interceptor] Sidecar unreachable for', path, '- returning fallback');
                // Return safe empty responses per endpoint type when sidecar is down
                if (path.startsWith('/api/analytics/file-ops')) {
                    return jsonResponse({ files: [], directories: [], period: '30 days', _fallback: true }, 503);
                }
                if (path.startsWith('/api/analytics/tool-stats')) {
                    return jsonResponse({ tools: [], period: '30 days', _fallback: true }, 503);
                }
                if (path.startsWith('/api/stats')) {
                    return jsonResponse({
                        daily: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, totalTokens: 0, cost: 0, count: 0 },
                        weekly: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, totalTokens: 0, cost: 0, count: 0 },
                        monthly: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, totalTokens: 0, cost: 0, count: 0 },
                        total: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, totalTokens: 0, cost: 0, count: 0 },
                        breakdowns: {
                            todayHourly: [],
                            weekDaily: [],
                            monthDaily: [],
                        },
                        _fallback: true,
                    }, 503);
                }
                if (path.startsWith('/api/telemetry')) {
                    return jsonResponse({
                        summary: { totalApiRequests: 0, totalApiErrors: 0, totalToolCalls: 0, avgApiLatencyMs: 0, avgToolLatencyMs: 0, p95ApiLatencyMs: 0 },
                        tokensByModel: {},
                        toolsByName: {},
                        recentEvents: [],
                        totalEvents: 0,
                        dataSource: 'db_fallback',
                        _fallback: true,
                    }, 503);
                }
                if (path.startsWith('/api/governance/summary')) {
                    return jsonResponse({
                        approvalMode: 'unknown',
                        policySources: [],
                        conflictCount: 0,
                        recentConfirmations: 0,
                        recentDenials: 0,
                        topDeniedTools: [],
                        activeModel: 'unknown',
                        activeProfile: 'default',
                        policyTiers: ['built-in'],
                        _fallback: true,
                    }, 503);
                }
                if (path.startsWith('/api/governance/steering')) {
                    return jsonResponse({
                        workspacePath: parsedUrl.searchParams.get('workspacePath') || '',
                        activeModel: '',
                        activeProfile: 'default',
                        workspaceOverrides: {
                            hasModelOverride: false,
                            hasProfileOverride: false,
                            model: null,
                            profile: null,
                        },
                        knownModels: [],
                        availableProfiles: ['default', 'autoEdit', 'plan', 'yolo'],
                        _fallback: true,
                    }, 503);
                }
                if (path.startsWith('/api/skills')) {
                    if (parsedUrl.searchParams.get('meta') === '1') {
                        return jsonResponse({ skills: [], sources: [], _fallback: true }, 503);
                    }
                    return jsonResponse([], 503);
                }
                if (path.startsWith('/api/agents')) return jsonResponse({ agents: [], _fallback: true }, 503);
                if (path.startsWith('/api/models')) return jsonResponse({ models: [] });
                if (path.startsWith('/api/mcp')) return jsonResponse({ discoveryState: 'idle', servers: {} });
                if (path.startsWith('/api/git')) return jsonResponse({ branches: [] });
                if (path.startsWith('/api/memory')) return jsonResponse({ memories: [] });
                if (path.startsWith('/api/hooks')) return jsonResponse({ hooks: [] });
                if (path.startsWith('/api/queue')) return jsonResponse({ items: [] });
                return jsonResponse({ error: 'Sidecar not available', _fallback: true }, 503);
            }

        } catch (error: any) {
            console.error('[Interceptor ERROR]', error);
            return jsonResponse({ error: error.message }, 500);
        }
    };
}
