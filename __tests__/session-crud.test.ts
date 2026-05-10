import { describe, expect, it, vi } from 'vitest';

// Mock the db module before importing session-crud
vi.mock('@/lib/db', () => ({
  default: {
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      get: vi.fn(() => null),
      run: vi.fn(() => ({ changes: 0 })),
    })),
  },
}));

import {
  parseJsonColumn,
  parseJsonArray,
  listSessions,
  createSession,
  getSession,
  deleteSession,
  archiveSession,
  updateSessionBranch,
  getLatestStats,
} from '@/lib/session-crud';

describe('parseJsonColumn', () => {
  it('returns fallback for null/undefined', () => {
    expect(parseJsonColumn(null)).toBeUndefined();
    expect(parseJsonColumn(undefined)).toBeUndefined();
    expect(parseJsonColumn(null, [])).toEqual([]);
  });

  it('returns parsed JSON for valid strings', () => {
    expect(parseJsonColumn('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonColumn('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('returns fallback for invalid JSON strings', () => {
    expect(parseJsonColumn('not json', [])).toEqual([]);
  });

  it('returns arrays as-is', () => {
    const arr = [1, 2, 3];
    expect(parseJsonColumn(arr)).toBe(arr);
  });

  it('returns fallback for non-string, non-array values', () => {
    expect(parseJsonColumn(42, 'default')).toBe('default');
    expect(parseJsonColumn(true, 'default')).toBe('default');
  });
});

describe('parseJsonArray', () => {
  it('returns undefined for null/undefined', () => {
    expect(parseJsonArray(null)).toBeUndefined();
    expect(parseJsonArray(undefined)).toBeUndefined();
  });

  it('returns arrays as-is', () => {
    const arr = [1, 2, 3];
    expect(parseJsonArray(arr)).toBe(arr);
  });

  it('returns parsed JSON arrays', () => {
    expect(parseJsonArray('[1,2,3]')).toEqual([1, 2, 3]);
    expect(parseJsonArray('[]')).toEqual([]);
  });

  it('returns undefined for JSON objects (not arrays)', () => {
    expect(parseJsonArray('{"url":"test"}')).toBeUndefined();
    expect(parseJsonArray('"hello"')).toBeUndefined();
    expect(parseJsonArray('42')).toBeUndefined();
  });

  it('returns undefined for invalid JSON strings', () => {
    expect(parseJsonArray('not json')).toBeUndefined();
  });

  it('returns undefined for non-string, non-array values', () => {
    expect(parseJsonArray(42)).toBeUndefined();
    expect(parseJsonArray(true)).toBeUndefined();
  });
});

describe('session CRUD helpers', () => {
  it('listSessions returns array from db', () => {
    const result = listSessions();
    expect(Array.isArray(result)).toBe(true);
  });

  it('createSession rejects empty workspace', () => {
    const result = createSession('');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('status', 400);
  });

  it('createSession rejects whitespace-only workspace', () => {
    const result = createSession('   ');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('status', 400);
  });

  it('getSession returns error for missing session', () => {
    const result = getSession('nonexistent-id');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('status', 404);
  });

  it('archiveSession rejects non-boolean archived value', () => {
    const result = archiveSession('test-id', 'yes' as unknown as boolean);
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('status', 400);
  });

  it('getLatestStats returns zero counters', () => {
    const stats = getLatestStats();
    expect(stats.totalTokens).toBe(0);
    expect(stats.cost).toBe(0);
    expect(stats.count).toBe(0);
  });
});
