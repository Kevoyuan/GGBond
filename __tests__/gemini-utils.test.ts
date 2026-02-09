import { describe, it, expect, vi, afterEach } from 'vitest';
import { getGeminiEnv } from '../lib/gemini-utils';

describe('getGeminiEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return an object with TERM set to dumb', () => {
    const env = getGeminiEnv();
    expect(env.TERM).toBe('dumb');
  });

  it('should return an object with GEMINI_FORCE_FILE_STORAGE set to true', () => {
    const env = getGeminiEnv();
    expect(env.GEMINI_FORCE_FILE_STORAGE).toBe('true');
  });

  it('should include other environment variables', () => {
    vi.stubEnv('TEST_VAR', 'test_value');
    const env = getGeminiEnv();
    expect(env.TEST_VAR).toBe('test_value');
  });

  it('should override existing TERM and GEMINI_FORCE_FILE_STORAGE values', () => {
    vi.stubEnv('TERM', 'xterm-256color');
    vi.stubEnv('GEMINI_FORCE_FILE_STORAGE', 'false');

    const env = getGeminiEnv();

    expect(env.TERM).toBe('dumb');
    expect(env.GEMINI_FORCE_FILE_STORAGE).toBe('true');
  });

  it('should not mutate process.env', () => {
    vi.stubEnv('TERM', 'original_term');
    const env = getGeminiEnv();

    expect(env.TERM).toBe('dumb');
    expect(process.env.TERM).toBe('original_term');
  });
});
