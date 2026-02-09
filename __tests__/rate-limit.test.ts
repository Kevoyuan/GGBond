import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should allow requests under the limit', () => {
    const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500 });
    const token = 'user-1';

    for (let i = 0; i < 10; i++) {
      expect(limiter.check(10, token)).toBe(false);
    }
  });

  it('should block requests over the limit', () => {
    const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500 });
    const token = 'user-2';

    // First 10 allowed
    for (let i = 0; i < 10; i++) {
      limiter.check(10, token);
    }

    // 11th blocked
    expect(limiter.check(10, token)).toBe(true);
  });

  it('should reset limit after interval', () => {
    const limiter = rateLimit({ interval: 1000, uniqueTokenPerInterval: 500 });
    const token = 'user-3';

    // Use up the limit
    for (let i = 0; i < 5; i++) {
      limiter.check(5, token);
    }
    expect(limiter.check(5, token)).toBe(true);

    // Advance time
    vi.advanceTimersByTime(1001);

    // Should be allowed now (sliding window logic, new request is current time)
    expect(limiter.check(5, token)).toBe(false);
  });

  it('should handle multiple tokens independently', () => {
    const limiter = rateLimit({ interval: 60000 });
    const token1 = 'user-A';
    const token2 = 'user-B';

    // User A uses limit
    for (let i = 0; i < 5; i++) {
        limiter.check(5, token1);
    }
    expect(limiter.check(5, token1)).toBe(true);

    // User B should be fine
    expect(limiter.check(5, token2)).toBe(false);
  });
});
