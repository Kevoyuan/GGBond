import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/skills/route';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => {
  return {
    spawn: mocks.spawn,
    default: {
        spawn: mocks.spawn
    }
  };
});

// Mock gemini-utils
vi.mock('@/lib/gemini-utils', () => ({
  getGeminiPath: vi.fn(() => '/mock/gemini'),
  getGeminiEnv: vi.fn(() => ({})),
}));

describe('POST /api/skills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.spawn.mockImplementation(() => ({
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => {
            if (event === 'close') cb(0);
        }),
    }));
  });

  it('should call spawn with correct args for valid skill name', async () => {
    const req = {
      json: async () => ({ action: 'enable', name: 'valid-skill-123' }),
    } as unknown as Request;

    const res = await POST(req);
    // Expect 200 OK
    expect(res.status).toBe(200);

    expect(mocks.spawn).toHaveBeenCalledWith(
        expect.any(String), // process.execPath
        ['/mock/gemini', 'skills', 'enable', 'valid-skill-123'],
        expect.any(Object)
    );
  });

  it('should reject invalid skill name with argument injection attempt', async () => {
    const req = {
      json: async () => ({ action: 'enable', name: 'skill; rm -rf /' }),
    } as unknown as Request;

    const res = await POST(req);

    // Expect 400 Bad Request
    expect(res.status).toBe(400);
    // spawn should NOT be called
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('should reject invalid skill name for disable action', async () => {
    const req = {
      json: async () => ({ action: 'disable', name: 'invalid_name' }), // Underscore not allowed by regex
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('should reject invalid skill name for uninstall action', async () => {
    const req = {
      json: async () => ({ action: 'uninstall', name: '.. ' }),
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});
