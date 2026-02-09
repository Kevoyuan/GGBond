import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/stats/route';

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  default: {
    prepare: mocks.prepare,
  },
}));

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data) => ({
      status: 200,
      json: async () => data,
    })),
  },
}));

describe('Stats API Integration Test', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset mocks
    mocks.prepare.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return empty stats when no messages exist', async () => {
    mocks.prepare.mockReturnValue({
      all: vi.fn().mockReturnValue([]),
    });

    const response = await GET();
    const data = await response.json();

    expect(data.total.count).toBe(0);
    expect(data.daily.count).toBe(0);
    expect(data.weekly.count).toBe(0);
    expect(data.monthly.count).toBe(0);
  });

  it('should aggregate stats correctly for different time ranges', async () => {
    // Set current date to Wednesday, Oct 25 2023
    const now = new Date('2023-10-25T12:00:00Z');
    vi.setSystemTime(now);

    const messages = [
      {
        // Today
        stats: JSON.stringify({
          model: 'gemini-1.5-pro',
          input_token_count: 100,
          output_token_count: 50,
          cached_content_token_count: 0,
        }),
        created_at: now.getTime(),
      },
      {
        // Monday (2 days ago) - This week
        stats: JSON.stringify({
          model: 'gemini-1.5-flash',
          input_token_count: 200,
          output_token_count: 100,
          cached_content_token_count: 20,
        }),
        created_at: now.getTime() - (86400000 * 2),
      },
      {
        // Last week (10 days ago) - This month
        stats: JSON.stringify({
          model: 'gemini-1.5-pro',
          input_token_count: 300,
          output_token_count: 150,
          cached_content_token_count: 0,
        }),
        created_at: now.getTime() - (86400000 * 10),
      },
      {
        // Last month (40 days ago) - Total only
        stats: JSON.stringify({
          model: 'gemini-1.5-flash',
          input_token_count: 400,
          output_token_count: 200,
          cached_content_token_count: 0,
        }),
        created_at: now.getTime() - (86400000 * 40),
      },
    ];

    mocks.prepare.mockReturnValue({
      all: vi.fn().mockReturnValue(messages),
    });

    const response = await GET();
    const data = await response.json();

    // Verify DB Query
    expect(mocks.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT stats, created_at'));

    // Total: All 4 messages
    expect(data.total.count).toBe(4);
    expect(data.total.inputTokens).toBe(100 + 200 + 300 + 400); // 1000

    // Monthly: Today, Monday, and Last Week (3 messages)
    expect(data.monthly.count).toBe(3);
    expect(data.monthly.inputTokens).toBe(100 + 200 + 300); // 600

    // Weekly: Today and Monday (2 messages)
    expect(data.weekly.count).toBe(2);
    expect(data.weekly.inputTokens).toBe(100 + 200); // 300

    // Daily: Today (1 message)
    expect(data.daily.count).toBe(1);
    expect(data.daily.inputTokens).toBe(100);
  });

  it('should handle malformed JSON gracefully', async () => {
    const now = new Date('2023-10-25T12:00:00Z');
    vi.setSystemTime(now);

    const messages = [
      {
        stats: 'invalid-json',
        created_at: now.getTime(),
      },
      {
        stats: JSON.stringify({
          model: 'gemini-1.5-pro',
          input_token_count: 50,
          output_token_count: 25,
        }),
        created_at: now.getTime(),
      },
    ];

    mocks.prepare.mockReturnValue({
      all: vi.fn().mockReturnValue(messages),
    });

    const response = await GET();
    const data = await response.json();

    // Should only count the valid message
    expect(data.total.count).toBe(1);
    expect(data.total.inputTokens).toBe(50);
  });

  it('should handle missing model fields gracefully', async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const messages = [
          {
              stats: JSON.stringify({}), // Empty object
              created_at: now.getTime()
          }
      ];

      mocks.prepare.mockReturnValue({
          all: vi.fn().mockReturnValue(messages)
      });

      const response = await GET();
      const data = await response.json();

      expect(data.total.count).toBe(1);
      expect(data.total.inputTokens).toBe(0);
      // Cost should be 0 as model is unknown and tokens are 0
      expect(data.total.cost).toBe(0);
  });
});
