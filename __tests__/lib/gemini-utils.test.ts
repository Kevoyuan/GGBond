import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGeminiPath } from '@/lib/gemini-utils';
import fs from 'fs';
import { execSync } from 'child_process';

// Mock fs and child_process
vi.mock('fs', () => {
    return {
        default: {
            realpathSync: vi.fn(),
        }
    };
});

vi.mock('child_process', () => {
  const execSync = vi.fn();
  const spawn = vi.fn();
  return {
    execSync,
    spawn,
    default: {
      execSync,
      spawn,
    },
  };
});

describe('getGeminiPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the resolved path when gemini is found', () => {
    const mockPath = '/usr/bin/gemini';
    const mockRealPath = '/opt/gemini/bin/gemini';

    vi.mocked(execSync).mockReturnValue(Buffer.from(mockPath + '\n'));
    vi.mocked(fs.realpathSync).mockReturnValue(mockRealPath);

    const result = getGeminiPath();

    expect(execSync).toHaveBeenCalledWith('which gemini');
    expect(fs.realpathSync).toHaveBeenCalledWith(mockPath);
    expect(result).toBe(mockRealPath);
  });

  it('should throw an error when gemini is not found (execSync throws)', () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('Command failed');
    });

    expect(() => getGeminiPath()).toThrow('Gemini CLI not found');
  });

   it('should throw an error when realpathSync fails', () => {
    const mockPath = '/usr/bin/gemini';
    vi.mocked(execSync).mockReturnValue(Buffer.from(mockPath + '\n'));
    vi.mocked(fs.realpathSync).mockImplementation(() => {
        throw new Error('File not found');
    });

    expect(() => getGeminiPath()).toThrow('Gemini CLI not found');
  });
});
