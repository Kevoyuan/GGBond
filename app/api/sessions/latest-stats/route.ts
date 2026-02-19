import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { calculateCost } from '@/lib/pricing';

export async function GET() {
  try {
    // Get the most recently updated session
    const latestSession = db.prepare(
      'SELECT id FROM sessions ORDER BY updated_at DESC LIMIT 1'
    ).get() as { id: string } | undefined;

    if (!latestSession) {
      return NextResponse.json({ totalTokens: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, cost: 0, count: 0 });
    }

    // Get all messages with stats for this session
    const messages = db.prepare(`
      SELECT stats FROM messages
      WHERE session_id = ? AND role = 'model' AND stats IS NOT NULL
    `).all(latestSession.id) as { stats: string }[];

    // Calculate cumulative stats
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let cachedTokens = 0;
    let cost = 0;

    for (const msg of messages) {
      if (msg.stats) {
        const stats = JSON.parse(msg.stats);
        const input = stats.inputTokenCount || stats.input_tokens || 0;
        const output = stats.outputTokenCount || stats.output_tokens || 0;
        const cached = stats.cachedContentTokenCount || stats.cached_content_token_count || stats.cached || 0;
        const model = stats.model;

        inputTokens += input;
        outputTokens += output;
        cachedTokens += cached;
        totalTokens += (input + output);
        cost += calculateCost(input, output, cached, model);
      }
    }

    return NextResponse.json({
      sessionId: latestSession.id,
      totalTokens,
      inputTokens,
      outputTokens,
      cachedTokens,
      cost,
      count: messages.length
    });
  } catch (error) {
    console.error('Failed to fetch session stats:', error);
    return NextResponse.json({ error: 'Failed to fetch session stats' }, { status: 500 });
  }
}
