import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { POST } from '../app/api/chat/route';
import { spawn } from 'child_process';

// Mock modules
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const mockSpawn = vi.fn();
  return {
    ...actual,
    spawn: mockSpawn,
    default: {
        ...actual,
        spawn: mockSpawn
    }
  };
});

vi.mock('../lib/db', () => ({
  default: {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    }),
    exec: vi.fn(),
  },
}));

vi.mock('../lib/gemini-utils', () => ({
  getGeminiPath: vi.fn().mockReturnValue('/mock/path/to/gemini'),
  getGeminiEnv: vi.fn().mockReturnValue({}),
}));

describe('Chat API Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (spawn as unknown as Mock).mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    });
  });

  it('should reject malicious model names with 400', async () => {
    const maliciousModel = '--malicious-flag';
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'hello',
        model: maliciousModel,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Invalid model parameter/i);

    const spawnCalls = (spawn as unknown as Mock).mock.calls;
    expect(spawnCalls.length).toBe(0);
  });

  it('should allow valid model names', async () => {
    const validModel = 'gemini-1.5-pro';
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'hello',
        model: validModel,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const spawnCalls = (spawn as unknown as Mock).mock.calls;
    expect(spawnCalls.length).toBe(1);
    const args = spawnCalls[0][1];
    expect(args).toContain('--model');
    expect(args).toContain(validModel);
  });

  it('should reject model names starting with dot', async () => {
     const invalidModel = '.hidden';
     const req = new Request('http://localhost/api/chat', {
       method: 'POST',
       body: JSON.stringify({
         prompt: 'hello',
         model: invalidModel,
       }),
     });

     const res = await POST(req);
     expect(res.status).toBe(400);

     const spawnCalls = (spawn as unknown as Mock).mock.calls;
     expect(spawnCalls.length).toBe(0);
  });
});
