import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // Get tool execution stats grouped by tool_name and status
    const toolStats = db.prepare(`
      SELECT
        tool_name,
        status,
        COUNT(*) as count,
        AVG(duration_ms) as avg_duration_ms
      FROM tool_stats
      WHERE created_at >= strftime('%s', 'now', '-30 days') * 1000
      GROUP BY tool_name, status
      ORDER BY tool_name, status
    `).all() as Array<{
      tool_name: string;
      status: string;
      count: number;
      avg_duration_ms: number | null;
    }>;

    // Group by tool name
    const toolStatsMap = new Map<string, {
      success: number;
      failed: number;
      total: number;
      avgDuration: number;
    }>();

    for (const stat of toolStats) {
      const existing = toolStatsMap.get(stat.tool_name) || {
        success: 0,
        failed: 0,
        total: 0,
        avgDuration: 0,
      };

      if (stat.status === 'success') {
        existing.success = stat.count;
      } else {
        existing.failed = stat.count;
      }
      existing.total += stat.count;
      if (stat.avg_duration_ms) {
        existing.avgDuration = stat.avg_duration_ms;
      }

      toolStatsMap.set(stat.tool_name, existing);
    }

    // Convert to array and calculate success rates
    const result = Array.from(toolStatsMap.entries())
      .map(([toolName, data]) => ({
        toolName,
        success: data.success,
        failed: data.failed,
        total: data.total,
        successRate: data.total > 0 ? (data.success / data.total) * 100 : 0,
        avgDurationMs: Math.round(data.avgDuration),
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      tools: result,
      period: '30 days',
    });
  } catch (error) {
    console.error('[tool-stats] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
