import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { NextResponse } from 'next/server';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  default: {
    prepare: vi.fn(() => ({
      get: vi.fn(),
      run: vi.fn(),
    })),
  },
}));

vi.mock('@/lib/gemini-utils', () => ({
  getGeminiPath: vi.fn(() => '/mock/path/gemini'),
  getGeminiEnv: vi.fn(() => ({})),
}));

// Mock child_process
vi.mock('child_process', () => ({
  default: {
    spawn: vi.fn(),
  },
  spawn: vi.fn(),
}));

// Mock rate-limit module
vi.mock('@/lib/rate-limit', () => {
  return {
    rateLimit: vi.fn(() => ({
      check: vi.fn((limit, token) => {
        // Only block 'blocked-ip'
        return token === 'blocked-ip';
      }),
    })),
  };
});

describe('Chat API Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 429 when rate limit is exceeded', async () => {
    const req = {
      headers: {
        get: (name: string) => name === 'x-forwarded-for' ? 'blocked-ip' : null,
      },
      json: vi.fn(),
    } as unknown as Request;

    const response = await POST(req);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBe('Too Many Requests');
  });

  it('should proceed if not rate limited', async () => {
     const req = {
      headers: {
        get: (name: string) => name === 'x-forwarded-for' ? 'allowed-ip' : null,
      },
      json: vi.fn().mockResolvedValue({}), // Resolve with empty object, prompting 'Prompt is required' error
    } as unknown as Request;

    const response = await POST(req);

    // Should NOT be 429
    expect(response.status).not.toBe(429);
    // Should be 400 because prompt is missing
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Prompt is required');
  });
});
