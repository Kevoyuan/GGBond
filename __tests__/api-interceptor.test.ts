import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { shouldProxyApiRequest } from '@/lib/api-interceptor';

// Mock Tauri invoke
const mockInvoke = vi.fn<(...args: unknown[]) => Promise<unknown>>(
  () => Promise.reject(new Error('not in tauri')),
);
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock db-client
vi.mock('@/lib/db-client', () => ({
  dbClient: {
    config: {
      get: vi.fn(() => Promise.resolve(null)),
      set: vi.fn(() => Promise.resolve()),
    },
  },
}));

describe('shouldProxyApiRequest', () => {
  const origin = 'http://localhost:3001';

  it('proxies relative app API paths', () => {
    expect(shouldProxyApiRequest('/api/sessions', origin)).toBe(true);
  });

  it('proxies absolute app API URLs across local dev ports', () => {
    expect(shouldProxyApiRequest('http://localhost:3000/api/sessions', origin)).toBe(true);
    expect(shouldProxyApiRequest('http://127.0.0.1:3000/api/sessions', origin)).toBe(true);
    expect(shouldProxyApiRequest('http://localhost:3001/api/sessions', origin)).toBe(true);
  });

  it('passes through non-API and non-local URLs', () => {
    expect(shouldProxyApiRequest('/modules', origin)).toBe(false);
    expect(shouldProxyApiRequest('https://example.com/api/sessions', origin)).toBe(false);
  });

  it('proxies IPv6 localhost URLs', () => {
    expect(shouldProxyApiRequest('http://[::1]:3000/api/sessions', origin)).toBe(true);
  });
});

describe('API interceptor fallback stubs', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns fallback for agents endpoint when sidecar is down', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('connection refused')));

    const { initApiInterceptor } = await import('@/lib/api-interceptor');
    initApiInterceptor();

    const response = await globalThis.fetch('/api/agents');
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body._fallback).toBe(true);
    expect(body).toHaveProperty('agents');
  }, 10000);

  it('returns 503 for skills endpoint with meta param', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('connection refused')));

    const { initApiInterceptor } = await import('@/lib/api-interceptor');
    initApiInterceptor();

    const response = await globalThis.fetch('/api/skills?meta=1');
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body._fallback).toBe(true);
    expect(body).toHaveProperty('skills');
    expect(body).toHaveProperty('sources');
  }, 10000);

  it('returns 503 for unknown API endpoints', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('connection refused')));

    const { initApiInterceptor } = await import('@/lib/api-interceptor');
    initApiInterceptor();

    const response = await globalThis.fetch('/api/unknown-endpoint');
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body._fallback).toBe(true);
    expect(body.error).toBe('Sidecar not available');
  }, 10000);

  it('consecutive requests both return fallback', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('connection refused')));

    const { initApiInterceptor } = await import('@/lib/api-interceptor');
    initApiInterceptor();

    // Both requests should return fallback without hanging
    const r1 = await globalThis.fetch('/api/agents');
    expect(r1.status).toBe(503);

    const r2 = await globalThis.fetch('/api/agents');
    expect(r2.status).toBe(503);
    const body = await r2.json();
    expect(body._fallback).toBe(true);
  }, 10000);
});

describe('sidecar fallback optimizations', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockInvoke.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('caches invoke result so retries reuse the same IPC call (single invoke per resolution)', async () => {
    // Simulate: sidecar on port 4001, invoke returns 4001, health probe fails.
    // The retry loop should NOT re-invoke; it should reuse the hoisted result.
    const invokeCount = { value: 0 };
    mockInvoke.mockImplementation(async () => {
      invokeCount.value += 1;
      return 4001;
    });

    const calls: string[] = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      calls.push(url);
      // Health probes and API requests to port 4001 all fail
      return Promise.reject(new Error('connection refused'));
    });
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    const { initApiInterceptor } = await import('@/lib/api-interceptor');
    initApiInterceptor();

    // This request triggers proxyToSidecar → resolveSidecarPort.
    // resolveSidecarPort runs 4 retry attempts, each probing candidate ports
    // (invoke result 4001 + fallback ports). With the hoisted-invoke
    // optimization, invoke should be called exactly once (before the loop),
    // not once per retry attempt (previously 1 + up to 4 = up to 5).
    const response = await globalThis.fetch('/api/agents');
    expect(response.status).toBe(503);

    expect(invokeCount.value).toBe(1);

    // Health probes target candidate ports (invoke result + fallback ports),
    // so not every probe hits 4001. But the invoke result (4001) must appear
    // among the probed ports at least once, confirming the hoisted value is used.
    const healthCalls = calls.filter((u) => u.includes('/api/health'));
    expect(healthCalls.length).toBeGreaterThanOrEqual(1);
    expect(healthCalls.some((u) => u.includes(':4001'))).toBe(true);
  }, 15000);

  it('concurrent requests share a single forced-refresh resolution (in-flight guard)', async () => {
    // Scenario: sidecar initially on port 4001, health probe succeeds but actual
    // request fails → triggers forced refresh. On the forced refresh the sidecar
    // is found on port 4002. We want concurrent failing requests to share one
    // forced-refresh resolution, not spawn independent stampedes.

    let healthPort: number | null = null;
    let apiPort: number | null = null;

    mockInvoke.mockImplementation(async () => {
      // First resolution (non-forced) → 4001; forced refresh → 4002
      if (healthPort === null) return 4001;
      return 4002;
    });

    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('/api/health')) {
        // Health probes always succeed (on whichever port)
        healthPort = parseInt(url.match(/:(\d+)/)?.[1] ?? '0', 10);
        return new Response(null, { status: 200 });
      }

      // Actual API requests: first resolution (4001) fails, forced refresh (4002) succeeds
      apiPort = parseInt(url.match(/:(\d+)/)?.[1] ?? '0', 10);
      if (apiPort === 4001) {
        return Promise.reject(new Error('connection refused'));
      }
      return new Response(JSON.stringify({ agents: [] }), { status: 200 });
    });
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    const { initApiInterceptor } = await import('@/lib/api-interceptor');
    initApiInterceptor();

    // Fire three requests concurrently. All three will fail on port 4001
    // and each triggers a forced refresh. The in-flight guard ensures only
    // one forced-refresh resolution executes; the other two share its result.
    const [r1, r2, r3] = await Promise.all([
      globalThis.fetch('/api/agents'),
      globalThis.fetch('/api/agents'),
      globalThis.fetch('/api/agents'),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);

    // Without the in-flight guard, each of the 3 failing requests would
    // independently call resolveSidecarPort(forceRefresh=true), resulting in
    // 3 × invoke = 6 total invocations (3 non-forced + 3 forced).
    // With the guard, the forced-refresh resolution is shared:
    // 1 initial invoke + 1 forced-refresh invoke = 2 total.
    // (Non-forced resolution also shares via resolvingSidecarPort.)
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  }, 15000);
});
