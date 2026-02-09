import { NextResponse } from 'next/server';
import db from '@/lib/db';

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

const createEmptyStat = (): StatEntry => ({
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  totalTokens: 0,
  cost: 0,
  count: 0,
});

const calculateCost = (model: string, input: number, output: number, cached: number): number => {
  // Estimated costs per 1M tokens (approximate values)
  // These should ideally come from a config or constant file
  let inputRate = 0;
  let outputRate = 0;
  let cachedRate = 0;

  if (model.includes('gemini-1.5-pro')) {
    inputRate = 3.50;
    outputRate = 10.50;
    cachedRate = 0.875;
  } else if (model.includes('gemini-1.5-flash')) {
    inputRate = 0.075;
    outputRate = 0.30;
    cachedRate = 0.01875;
  } else if (model.includes('gemini-2.0-flash')) {
      inputRate = 0.10;
      outputRate = 0.40;
      cachedRate = 0.025; // Assumption
  } else {
      // Default to Pro rates for unknown high-end models, or Flash for others?
      // Let's go with a middle ground or 0 if completely unknown
      inputRate = 0;
      outputRate = 0;
  }

  return (input * inputRate + output * outputRate + cached * cachedRate) / 1_000_000;
};

export async function GET() {
  const stats: UsageStats = {
    daily: createEmptyStat(),
    weekly: createEmptyStat(),
    monthly: createEmptyStat(),
    total: createEmptyStat(),
  };

  try {
    // Fetch all messages with stats
    // We only care about 'model' messages that have stats
    const messages = db.prepare(`
      SELECT stats, created_at
      FROM messages
      WHERE role = ? AND stats IS NOT NULL
    `).all('model') as { stats: string; created_at: number }[];

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    for (const row of messages) {
      let parsedStats;
      try {
        parsedStats = JSON.parse(row.stats);
      } catch {
        continue; // Skip malformed JSON
      }

      const timestamp = row.created_at;
      
      const model = parsedStats.model || 'unknown';
      const input = parsedStats.input_token_count || 0;
      const output = parsedStats.output_token_count || 0;
      const cached = parsedStats.cached_content_token_count || 0;
      const total = parsedStats.total_token_count || (input + output);
      
      const cost = calculateCost(model, input, output, cached);

      const updateStat = (stat: StatEntry) => {
        stat.inputTokens += input;
        stat.outputTokens += output;
        stat.cachedTokens += cached;
        stat.totalTokens += total;
        stat.cost += cost;
        stat.count += 1;
      };

      // Update Total
      updateStat(stats.total);

      // Update Daily
      if (timestamp >= startOfDay) {
        updateStat(stats.daily);
      }

      // Update Weekly
      if (timestamp >= startOfWeek) {
        updateStat(stats.weekly);
      }

      // Update Monthly
      if (timestamp >= startOfMonth) {
        updateStat(stats.monthly);
      }
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to calculate stats:', error);
    // Return empty stats on error to avoid UI crash
    return NextResponse.json(stats);
  }
}
