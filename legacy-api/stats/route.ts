import { NextResponse } from '@/src-sidecar/mock-next-server';
import db from '@/lib/db';
import { calculateCost } from '@/lib/pricing';
import { normalizeTokenStats } from '@/lib/token-stats';
import { addDays, endOfMonth, format, startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns';

interface StatEntry {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  cost: number;
  count: number;
}

interface UsageStats {
  daily: StatEntry;
  weekly: StatEntry;
  monthly: StatEntry;
  total: StatEntry;
}

interface TimeBucket {
  key: string;
  label: string;
  totalTokens: number;
  models: Record<string, number>;
}

interface UsageStatsResponse extends UsageStats {
  breakdowns: {
    todayHourly: TimeBucket[];
    weekDaily: TimeBucket[];
    monthDaily: TimeBucket[];
  };
}

const initialStat: StatEntry = {
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  totalTokens: 0,
  cost: 0,
  count: 0,
};

function toMillis(value: number): number {
  // Backward compatibility: some data sources might store UNIX seconds.
  return value < 10_000_000_000 ? value * 1000 : value;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offsetStr = searchParams.get('offset');
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    // Fetch all messages with stats
    // We only care about 'model' messages that have stats
    const messages = db.prepare(`
      SELECT stats, created_at 
      FROM messages 
      WHERE role = 'model' AND stats IS NOT NULL
    `).all() as { stats: string; created_at: number }[];

    const now = new Date();

    const targetMonth = offset > 0 ? subMonths(now, offset) : now;

    const dayStart = offset > 0 ? startOfDay(targetMonth) : startOfDay(now);
    const weekStart = offset > 0 ? startOfWeek(targetMonth, { weekStartsOn: 1 }) : startOfWeek(now, { weekStartsOn: 1 }); // Monday start
    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);
    const monthDays = monthEnd.getDate();

    const stats: UsageStatsResponse = {
      daily: { ...initialStat },
      weekly: { ...initialStat },
      monthly: { ...initialStat },
      total: { ...initialStat },
      breakdowns: {
        todayHourly: Array.from({ length: 24 }, (_, hour) => ({
          key: `${String(hour).padStart(2, '0')}:00`,
          label: `${String(hour).padStart(2, '0')}:00`,
          totalTokens: 0,
          models: {},
        })),
        weekDaily: Array.from({ length: 7 }, (_, dayOffset) => {
          const bucketDate = addDays(weekStart, dayOffset);
          return {
            key: format(bucketDate, 'yyyy-MM-dd'),
            label: format(bucketDate, 'MM/dd'),
            totalTokens: 0,
            models: {},
          };
        }),
        monthDaily: Array.from({ length: monthDays }, (_, dayOffset) => {
          const bucketDate = addDays(monthStart, dayOffset);
          return {
            key: format(bucketDate, 'yyyy-MM-dd'),
            label: format(bucketDate, 'MM/dd'),
            totalTokens: 0,
            models: {},
          };
        }),
      },
    };

    for (const msg of messages) {
      try {
        const data = normalizeTokenStats(JSON.parse(msg.stats));
        if (!data) {
          continue;
        }
        const createdAtMs = toMillis(msg.created_at);
        const createdAt = new Date(createdAtMs);

        const input = data.inputTokens;
        const output = data.outputTokens;
        const cached = data.cachedTokens;
        const total = data.totalTokens || (input + output);
        const modelBreakdown = data.perModelUsage.length > 0
          ? data.perModelUsage
          : [{
            model: data.model || 'gemini-3-pro-preview',
            inputTokens: input,
            outputTokens: output,
            cachedTokens: cached,
            thoughtsTokens: data.thoughtsTokens,
            totalTokens: total,
          }];
        const cost = data.totalCost || modelBreakdown.reduce((sum, entry) => (
          sum + calculateCost(
            entry.inputTokens,
            entry.outputTokens,
            entry.cachedTokens,
            entry.model
          )
        ), 0);

        // Helper to accumulate
        const accumulate = (entry: StatEntry) => {
          entry.inputTokens += input;
          entry.outputTokens += output;
          entry.cachedTokens += cached;
          entry.totalTokens += total;
          entry.cost += cost;
          entry.count += 1;
        };

        // Total
        accumulate(stats.total);

        // Daily
        if (createdAt >= dayStart) {
          accumulate(stats.daily);
        }

        // Weekly
        if (createdAt >= weekStart) {
          accumulate(stats.weekly);
        }

        // Monthly
        if (createdAt >= monthStart) {
          accumulate(stats.monthly);
        }

        const perModelTotals = modelBreakdown.map((entry) => ({
          model: entry.model || 'unknown',
          totalTokens: Math.max(entry.totalTokens || (entry.inputTokens + entry.outputTokens), 0),
        }));

        // Today hourly buckets
        if (createdAt >= dayStart) {
          const hourIndex = Math.floor((createdAtMs - dayStart.getTime()) / (60 * 60 * 1000));
          if (hourIndex >= 0 && hourIndex < 24) {
            const bucket = stats.breakdowns.todayHourly[hourIndex];
            bucket.totalTokens += total;
            for (const perModel of perModelTotals) {
              bucket.models[perModel.model] = (bucket.models[perModel.model] || 0) + perModel.totalTokens;
            }
          }
        }

        // This week daily buckets (Mon-Sun)
        if (createdAt >= weekStart) {
          const dayIndex = Math.floor((createdAtMs - weekStart.getTime()) / (24 * 60 * 60 * 1000));
          if (dayIndex >= 0 && dayIndex < 7) {
            const bucket = stats.breakdowns.weekDaily[dayIndex];
            bucket.totalTokens += total;
            for (const perModel of perModelTotals) {
              bucket.models[perModel.model] = (bucket.models[perModel.model] || 0) + perModel.totalTokens;
            }
          }
        }

        // This month daily buckets
        if (createdAt >= monthStart && createdAt <= monthEnd) {
          const dayIndex = Math.floor((createdAtMs - monthStart.getTime()) / (24 * 60 * 60 * 1000));
          if (dayIndex >= 0 && dayIndex < monthDays) {
            const bucket = stats.breakdowns.monthDaily[dayIndex];
            bucket.totalTokens += total;
            for (const perModel of perModelTotals) {
              bucket.models[perModel.model] = (bucket.models[perModel.model] || 0) + perModel.totalTokens;
            }
          }
        }
      } catch (e) {
        // Ignore bad JSON
      }
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
