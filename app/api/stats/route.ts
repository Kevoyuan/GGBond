import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
  const logPath = join(process.cwd(), '.gemini', 'telemetry.log');
  
  const stats: UsageStats = {
    daily: createEmptyStat(),
    weekly: createEmptyStat(),
    monthly: createEmptyStat(),
    total: createEmptyStat(),
  };

  if (!existsSync(logPath)) {
    return NextResponse.json(stats);
  }

  try {
    const lines = readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
    const apiResponses = lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(l => l && l.name === 'gemini_cli.api_response');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    for (const event of apiResponses) {
      // Try to find timestamp
      let timestamp = Date.now(); // Default to now if missing (which shouldn't happen in good telemetry)
      if (event.timestamp) timestamp = new Date(event.timestamp).getTime();
      else if (event.time) timestamp = new Date(event.time).getTime();
      else if (event.date) timestamp = new Date(event.date).getTime();
      else if (event.attributes?.timestamp) timestamp = new Date(event.attributes.timestamp).getTime();
      
      const model = event.attributes?.model || 'unknown';
      const input = event.attributes?.input_token_count || 0;
      const output = event.attributes?.output_token_count || 0;
      const cached = event.attributes?.cached_content_token_count || 0;
      const total = (event.attributes?.total_token_count || (input + output)); // Sometimes total is provided
      
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
    console.error('Failed to parse telemetry:', error);
    // Return empty stats on error to avoid UI crash
    return NextResponse.json(stats);
  }
}
