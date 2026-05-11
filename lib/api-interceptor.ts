import { dbClient } from './db-client';
import { invoke } from '@tauri-apps/api/core';
import { SIDECAR_DEFAULT_PORT } from './sidecar-port';

let initialized = false;
let cachedSidecarPort: number | null = null;
let resolvingSidecarPort: Promise<number> | null = null;
let lastResolveFoundLivePort = false;
let inflightForcedRefresh: Promise<number> | null = null;
const sidecarHealthCache = new Map<number, { ok: boolean; expiresAt: number }>();
const sidecarConsecutiveFailures = new Map<number, number>();
const SIDECAR_HEALTH_OK_TTL_MS = 2500;
const SIDECAR_HEALTH_FAIL_TTL_MS = 350;
const SIDECAR_CIRCUIT_THRESHOLD = 5;
const SIDECAR_CIRCUIT_RESET_MS = 10000;
const SESSION_API_RE = /^\/api\/sessions\/[^/]+(?:\/(?:archive|branch))?$/;

// We need a helper to read JSON body
async function readBody(init?: RequestInit): Promise<Record<string, unknown>> {
    if (!init?.body) return {};
    if (typeof init.body === 'string') return JSON.parse(init.body);
    return {};
}

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function canReachSidecar(port: number, originalFetch: typeof window.fetch, forceRefresh = false) {
    const now = Date.now();
    const cached = sidecarHealthCache.get(port);
    if (!forceRefresh && cached && cached.expiresAt > now) {
        return cached.ok;
    }

    // Circuit breaker: skip probe if too many consecutive failures
    const failures = sidecarConsecutiveFailures.get(port) || 0;
    if (!forceRefresh && failures >= SIDECAR_CIRCUIT_THRESHOLD) {
        const backoffMs = Math.min(SIDECAR_CIRCUIT_RESET_MS, SIDECAR_HEALTH_FAIL_TTL_MS * Math.pow(2, failures));
        const circuitExpiresAt = (cached?.expiresAt ?? 0) + backoffMs;
        if (now < circuitExpiresAt) {
            return false;
        }
        // Allow one probe through (half-open state)
    }

    try {
        const res = await originalFetch(`http://127.0.0.1:${port}/api/health`);
        const ok = res.ok;
        if (ok) {
            sidecarConsecutiveFailures.delete(port);
        } else {
            sidecarConsecutiveFailures.set(port, failures + 1);
        }
        sidecarHealthCache.set(port, {
            ok,
            expiresAt: now + (ok ? SIDECAR_HEALTH_OK_TTL_MS : SIDECAR_HEALTH_FAIL_TTL_MS),
        });
        return ok;
    } catch {
        sidecarConsecutiveFailures.set(port, failures + 1);
        sidecarHealthCache.set(port, {
            ok: false,
            expiresAt: now + SIDECAR_HEALTH_FAIL_TTL_MS,
        });
        return false;
    }
}

function recordSidecarFailure(port: number) {
    const failures = sidecarConsecutiveFailures.get(port) || 0;
    sidecarConsecutiveFailures.set(port, failures + 1);
    sidecarHealthCache.set(port, { ok: false, expiresAt: Date.now() + SIDECAR_HEALTH_FAIL_TTL_MS });
}

function invalidateSidecarPort(port: number) {
    sidecarHealthCache.delete(port);
    if (cachedSidecarPort === port) {
        cachedSidecarPort = null;
    }
}

function buildDiagnosticsFallback(path: string) {
    const now = Date.now();
    const health = Array.from(sidecarHealthCache.entries()).map(([port, value]) => ({
        port,
        ok: value.ok,
        ttlMs: Math.max(0, value.expiresAt - now),
        circuitOpen: isCircuitOpen(port),
        failures: sidecarConsecutiveFailures.get(port) || 0,
    }));

    const consecutiveFailures = Array.from(sidecarConsecutiveFailures.entries()).map(([port, failures]) => ({
        port,
        failures,
        circuitOpen: isCircuitOpen(port),
    }));
    const inferredPort = cachedSidecarPort
        ?? health[0]?.port
        ?? consecutiveFailures[0]?.port
        ?? SIDECAR_DEFAULT_PORT;

    return {
        status: 'unavailable',
        engine: 'browser-interceptor',
        error: 'Sidecar not available',
        port: inferredPort,
        _fallback: true,
        client: {
            path,
            cachedSidecarPort,
            lastResolveFoundLivePort,
            resolvingSidecarPort: Boolean(resolvingSidecarPort),
            forcedRefreshInFlight: Boolean(inflightForcedRefresh),
            health,
            consecutiveFailures,
        },
        events: [
            {
                name: 'client:diagnostics-fallback',
                ts: now,
                elapsedMs: 0,
                meta: {
                    path,
                    cachedSidecarPort: cachedSidecarPort ?? 'none',
                },
            },
        ],
    };
}

export function shouldProxyApiRequest(url: string, locationOrigin: string) {
    if (url.startsWith('/api/')) return true;

    try {
        const parsedUrl = new URL(url, locationOrigin);
        if (!parsedUrl.pathname.startsWith('/api/')) return false;

        return parsedUrl.origin === locationOrigin
            || parsedUrl.hostname === 'localhost'
            || parsedUrl.hostname === '127.0.0.1'
            || parsedUrl.hostname === '[::1]';
    } catch {
        return false;
    }
}

function getFetchUrl(input: RequestInfo | URL) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    if (input instanceof Request) return input.url;
    return '';
}

function isCircuitOpen(port: number) {
    const failures = sidecarConsecutiveFailures.get(port) || 0;
    if (failures < SIDECAR_CIRCUIT_THRESHOLD) return false;
    const cached = sidecarHealthCache.get(port);
    const backoffMs = Math.min(SIDECAR_CIRCUIT_RESET_MS, SIDECAR_HEALTH_FAIL_TTL_MS * Math.pow(2, failures));
    const circuitExpiresAt = (cached?.expiresAt ?? 0) + backoffMs;
    return Date.now() < circuitExpiresAt;
}

async function resolveSidecarPort(originalFetch: typeof window.fetch, forceRefresh = false) {
    if (!forceRefresh && cachedSidecarPort && await canReachSidecar(cachedSidecarPort, originalFetch)) {
        return cachedSidecarPort;
    }

    if (!forceRefresh && resolvingSidecarPort) {
        return resolvingSidecarPort;
    }

    resolvingSidecarPort = (async () => {
        const fallbackPorts = [cachedSidecarPort, SIDECAR_DEFAULT_PORT].filter((value): value is number => typeof value === 'number');

        // Fast-fail: if all known ports have open circuits, skip probing
        const allPortsOpen = fallbackPorts.length > 0 && fallbackPorts.every(isCircuitOpen);
        if (!forceRefresh && allPortsOpen) {
            lastResolveFoundLivePort = false;
            return fallbackPorts[0];
        }

        // Hoist IPC call: resolve invoke once per resolution attempt so the
        // retry loop reuses the same port rather than making redundant Tauri
        // IPC round-trips on every iteration.
        const invokeResult = allPortsOpen && !forceRefresh
            ? null
            : await invoke<number>('get_sidecar_port').catch(() => null);

        const maxAttempts = allPortsOpen ? 1 : 4;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const candidates = [invokeResult, ...fallbackPorts]
                .filter((value): value is number => typeof value === 'number' && value > 0)
                .filter((value, index, array) => array.indexOf(value) === index);

            for (const port of candidates) {
                if (await canReachSidecar(port, originalFetch, forceRefresh)) {
                    cachedSidecarPort = port;
                    lastResolveFoundLivePort = true;
                    return port;
                }
            }

            if (attempt < maxAttempts - 1) {
                await sleep(150 * (attempt + 1));
            }
        }

        // If invoke found a port but all health probes failed, trust the
        // invoke result as a last resort (same as before, no extra IPC).
        const finalPort = invokeResult;
        if (typeof finalPort === 'number' && finalPort > 0) {
            cachedSidecarPort = finalPort;
            lastResolveFoundLivePort = false;
            return finalPort;
        }

        cachedSidecarPort = cachedSidecarPort ?? SIDECAR_DEFAULT_PORT;
        lastResolveFoundLivePort = false;
        return cachedSidecarPort;
    })().finally(() => {
        resolvingSidecarPort = null;
    });

    return resolvingSidecarPort;
}

function isSessionApiPath(path: string) {
    return path === '/api/sessions'
        || path === '/api/sessions/core'
        || path === '/api/sessions/latest-stats'
        || SESSION_API_RE.test(path);
}

async function proxyToSidecar(
    path: string,
    search: string,
    init: RequestInit | undefined,
    originalFetch: typeof window.fetch,
    forceRefresh = false
) {
    const sidecarPort = await resolveSidecarPort(originalFetch, forceRefresh);

    try {
        return await originalFetch(`http://127.0.0.1:${sidecarPort}${path}${search}`, init);
    } catch (error) {
        // Record failure for circuit breaker (don't clear it)
        recordSidecarFailure(sidecarPort);
        if (cachedSidecarPort === sidecarPort) {
            cachedSidecarPort = null;
        }

        // Only retry with forceRefresh if the last resolution actually found a live port
        // (avoids doubling the probe time when sidecar is already known to be down).
        // Concurrent failures share a single forced-refresh resolution to avoid
        // stampedes of redundant health probes.
        if (!forceRefresh && lastResolveFoundLivePort) {
            const retryPort = await (inflightForcedRefresh ??= resolveSidecarPort(originalFetch, true)
                .finally(() => { inflightForcedRefresh = null; }));
            if (retryPort !== sidecarPort) {
                return originalFetch(`http://127.0.0.1:${retryPort}${path}${search}`, init);
            }
        }

        throw error;
    }
}

export function initApiInterceptor() {
    if (typeof window === 'undefined' || initialized) return;
    initialized = true;

    const originalFetch = window.fetch;

    window.fetch = async (input, init) => {
        const url = getFetchUrl(input);

        // If it is not an app API request, pass through.
        if (!shouldProxyApiRequest(url, window.location.origin)) {
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
                return proxyToSidecar(path, parsedUrl.search, init, originalFetch);
            }
            if (path.startsWith('/api/chat/cancel')) {
                return proxyToSidecar('/api/chat/cancel', '', init, originalFetch);
            }
            if (path === '/api/chat') {
                return proxyToSidecar('/api/chat', '', init, originalFetch);
            }
            if (path === '/api/confirm') {
                return proxyToSidecar('/api/confirm', '', init, originalFetch);
            }

            // ============================================
            // 2. SESSIONS (Sidecar - single source of truth)
            // ============================================
            if (isSessionApiPath(path)) {
                return proxyToSidecar(path, parsedUrl.search, init, originalFetch);
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
                    await dbClient.config.set('geminiignore', typeof content === 'string' ? content : '');
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
            try {
                return await proxyToSidecar(path, parsedUrl.search, init, originalFetch);
            } catch (proxyError) {
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
                if (path.startsWith('/api/diagnostics')) {
                    return jsonResponse(buildDiagnosticsFallback(path), 503);
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

        } catch (error: unknown) {
            console.error('[Interceptor ERROR]', error);
            const message = error instanceof Error ? error.message : String(error);
            return jsonResponse({ error: message }, 500);
        }
    };
}
