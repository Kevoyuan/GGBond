import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { calculateCost } from '@/lib/pricing';
import { startOfDay, startOfWeek, startOfMonth, isAfter } from 'date-fns';

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

const initialStat: StatEntry = {
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  totalTokens: 0,
  cost: 0,
  count: 0,
};

export async function GET() {
  try {
    // Fetch all messages with stats
    // We only care about 'model' messages that have stats
    const messages = db.prepare(`
      SELECT stats, created_at 
      FROM messages 
      WHERE role = 'model' AND stats IS NOT NULL
    `).all() as { stats: string; created_at: number }[];

    const now = new Date();
    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
    const monthStart = startOfMonth(now);

    const stats: UsageStats = {
      daily: { ...initialStat },
      weekly: { ...initialStat },
      monthly: { ...initialStat },
      total: { ...initialStat },
    };

    for (const msg of messages) {
      try {
        const data = JSON.parse(msg.stats);
        const createdAt = new Date(msg.created_at);

        // Normalize field names (CLI uses snake_case, UI might use camelCase)
        const input = data.input_tokens || data.inputTokenCount || 0;
        const output = data.output_tokens || data.outputTokenCount || 0;
        const cached = data.cached || data.cachedContentTokenCount || 0;
        const total = data.total_tokens || data.totalTokenCount || (input + output);
        
        // Use provided cost or calculate it
        const modelName = data.model || 'auto-gemini-3'; // Default to auto-gemini-3 (Gemini 3 Pro) if not found
        const cost = data.totalCost || calculateCost(input, output, cached, modelName);

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
        if (isAfter(createdAt, dayStart)) {
          accumulate(stats.daily);
        }

        // Weekly
        if (isAfter(createdAt, weekStart)) {
          accumulate(stats.weekly);
        }

        // Monthly
        if (isAfter(createdAt, monthStart)) {
          accumulate(stats.monthly);
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
