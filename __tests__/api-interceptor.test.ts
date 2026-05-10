import { describe, expect, it } from 'vitest';
import { shouldProxyApiRequest } from '@/lib/api-interceptor';

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
});
