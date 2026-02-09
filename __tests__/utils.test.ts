import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    const result = cn('c1', 'c2');
    expect(result).toBe('c1 c2');
  });

  it('should handle conditional classes', () => {
    const result = cn('c1', true && 'c2', false && 'c3');
    expect(result).toBe('c1 c2');
  });

  it('should handle arrays of classes', () => {
    const result = cn(['c1', 'c2'], 'c3');
    expect(result).toBe('c1 c2 c3');
  });

  it('should handle objects with boolean values', () => {
    const result = cn({ c1: true, c2: false, c3: true });
    expect(result).toBe('c1 c3');
  });

  it('should handle mixed inputs', () => {
    const result = cn('c1', ['c2', { c3: true, c4: false }], 'c5');
    expect(result).toBe('c1 c2 c3 c5');
  });

  it('should merge tailwind classes correctly (override)', () => {
    const result = cn('px-2 py-1', 'p-4');
    // p-4 overrides px-2 and py-1 in tailwind-merge
    expect(result).toBe('p-4');
  });

  it('should handle undefined and null inputs', () => {
    const result = cn('c1', undefined, null, 'c2');
    expect(result).toBe('c1 c2');
  });

  it('should handle empty inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });
});
