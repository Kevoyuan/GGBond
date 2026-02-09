import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGeminiPath } from '../lib/gemini-utils';
import fs from 'fs';
import { execSync } from 'child_process';

// Mock child_process
vi.mock('child_process', () => {
  const execSync = vi.fn();
  const spawn = vi.fn();
  return {
    execSync,
    spawn,
    default: { execSync, spawn }
  };
});

// Mock fs
vi.mock('fs', () => ({
  default: {
    realpathSync: vi.fn(),
  },
}));

describe('getGeminiPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the resolved path when gemini executable is found', () => {
    // Setup mocks
    vi.mocked(execSync).mockReturnValue(Buffer.from('/usr/bin/gemini\n'));
    vi.mocked(fs.realpathSync).mockReturnValue('/usr/bin/gemini');

    const path = getGeminiPath();

    expect(execSync).toHaveBeenCalledWith('which gemini');
    expect(fs.realpathSync).toHaveBeenCalledWith('/usr/bin/gemini');
    expect(path).toBe('/usr/bin/gemini');
  });

  it('should throw error when gemini executable is not found', () => {
    // Setup mocks to throw
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('Command failed');
    });

    expect(() => getGeminiPath()).toThrow('Gemini CLI not found');
    expect(execSync).toHaveBeenCalledWith('which gemini');
  });

  it('should throw error when realpath fails', () => {
    // Setup mocks
    vi.mocked(execSync).mockReturnValue(Buffer.from('/usr/bin/gemini\n'));
    vi.mocked(fs.realpathSync).mockImplementation(() => {
        throw new Error('File not found');
    });

    expect(() => getGeminiPath()).toThrow('Gemini CLI not found');
    expect(execSync).toHaveBeenCalledWith('which gemini');
    expect(fs.realpathSync).toHaveBeenCalledWith('/usr/bin/gemini');
  });
});
