import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { shouldProxyApiRequest } from '@/lib/api-interceptor';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.reject(new Error('not in tauri'))),
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
