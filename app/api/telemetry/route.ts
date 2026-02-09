import { NextResponse } from 'next/server';
import { parseTelemetryLog } from '@/lib/gemini-service';

export async function GET() {
    try {
        const events = await parseTelemetryLog(1000);

        // Aggregate by event type
        const apiResponses = events.filter(e => e.name === 'gemini_cli.api_response');
        const toolCalls = events.filter(e => e.name === 'gemini_cli.tool_call');
        const apiErrors = events.filter(e => e.name === 'gemini_cli.api_error');

        // Calculate aggregate metrics
        const apiLatencies = apiResponses
            .map(e => e.attributes.duration_ms)
            .filter((v): v is number => typeof v === 'number');

        const toolLatencies = toolCalls
            .map(e => e.attributes.duration_ms)
            .filter((v): v is number => typeof v === 'number');

        const tokensByModel: Record<string, { input: number; output: number; cached: number; thoughts: number }> = {};
        for (const evt of apiResponses) {
            const model = evt.attributes.model || 'unknown';
            if (!tokensByModel[model]) {
                tokensByModel[model] = { input: 0, output: 0, cached: 0, thoughts: 0 };
            }
            tokensByModel[model].input += evt.attributes.input_token_count || 0;
            tokensByModel[model].output += evt.attributes.output_token_count || 0;
            tokensByModel[model].cached += evt.attributes.cached_content_token_count || 0;
            tokensByModel[model].thoughts += evt.attributes.thoughts_token_count || 0;
        }

        const toolsByName: Record<string, { count: number; success: number; fail: number; avgLatency: number }> = {};
        for (const evt of toolCalls) {
            const name = evt.attributes.function_name || 'unknown';
            if (!toolsByName[name]) {
                toolsByName[name] = { count: 0, success: 0, fail: 0, avgLatency: 0 };
            }
            toolsByName[name].count += 1;
            if (evt.attributes.success) toolsByName[name].success += 1;
            else toolsByName[name].fail += 1;
            if (typeof evt.attributes.duration_ms === 'number') {
                toolsByName[name].avgLatency = (
                    (toolsByName[name].avgLatency * (toolsByName[name].count - 1) + evt.attributes.duration_ms) /
                    toolsByName[name].count
                );
            }
        }

        return NextResponse.json({
            summary: {
                totalApiRequests: apiResponses.length,
                totalApiErrors: apiErrors.length,
                totalToolCalls: toolCalls.length,
                avgApiLatencyMs: apiLatencies.length
                    ? Math.round(apiLatencies.reduce((a, b) => a + b, 0) / apiLatencies.length)
                    : 0,
                avgToolLatencyMs: toolLatencies.length
                    ? Math.round(toolLatencies.reduce((a, b) => a + b, 0) / toolLatencies.length)
                    : 0,
                p95ApiLatencyMs: apiLatencies.length
                    ? apiLatencies.sort((a, b) => a - b)[Math.floor(apiLatencies.length * 0.95)] || 0
                    : 0,
            },
            tokensByModel,
            toolsByName,
            recentEvents: events.slice(-50),
            totalEvents: events.length,
        });
    } catch (error) {
        console.error('Failed to parse telemetry:', error);
        return NextResponse.json({
            summary: { totalApiRequests: 0, totalApiErrors: 0, totalToolCalls: 0, avgApiLatencyMs: 0, avgToolLatencyMs: 0, p95ApiLatencyMs: 0 },
            tokensByModel: {},
            toolsByName: {},
            recentEvents: [],
            totalEvents: 0,
        });
    }
}
