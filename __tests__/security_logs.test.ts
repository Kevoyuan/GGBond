import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks must be hoisted or defined before imports
vi.mock('@/lib/db', () => ({
  default: {
    prepare: vi.fn(() => ({
      get: vi.fn(),
      run: vi.fn(),
    })),
  },
}));

vi.mock('@/lib/gemini-utils', () => ({
  getGeminiPath: vi.fn(() => '/mock/path/to/gemini'),
  getGeminiEnv: vi.fn(() => ({ HOME: '/mock/home/user' })),
}));

vi.mock('child_process', () => ({
  __esModule: true,
  default: {
    spawn: vi.fn(() => ({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    })),
  },
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  })),
}));

// Import the function under test AFTER mocking
import { POST } from '@/app/api/chat/route';

describe('Security Log Check', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    // Spy on console.log
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should not log sensitive environment variables', async () => {
    const req = {
      json: async () => ({
        prompt: 'hello',
        model: 'test-model',
      }),
    } as any;

    try {
      await POST(req);
    } catch (e) {
      // Ignore errors related to stream/NextResponse if any,
      // we only care about the console.log calls before that
    }

    // Check if console.log was called
    const calls = consoleLogSpy.mock.calls.map((args: any[]) => args.join(' ')).join('\n');

    // We expect the logs NOT to contain the sensitive HOME path
    expect(calls).not.toContain('/mock/home/user');
    expect(calls).not.toContain('Running gemini with HOME:');
  });
});
