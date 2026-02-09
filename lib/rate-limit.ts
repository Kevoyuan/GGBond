import { LRUCache } from 'lru-cache';

interface RateLimitOptions {
  interval: number; // Interval in milliseconds
  uniqueTokenPerInterval?: number; // Max number of unique tokens to track
}

export function rateLimit(options: RateLimitOptions) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval,
  });

  return {
    check: (limit: number, token: string) => {
      const now = Date.now();
      const windowStart = now - options.interval;

      // Get existing timestamps
      const timestamps = tokenCache.get(token) || [];

      // Filter out timestamps outside the window
      const validTimestamps = timestamps.filter((t) => t > windowStart);

      const currentUsage = validTimestamps.length;
      const isRateLimited = currentUsage >= limit;

      if (!isRateLimited) {
        validTimestamps.push(now);
        tokenCache.set(token, validTimestamps);
      } else {
         // Update to keep the entry alive and clean up old timestamps
         tokenCache.set(token, validTimestamps);
      }

      return isRateLimited;
    },
  };
}
