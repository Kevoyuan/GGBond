import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export interface GovernanceSummaryView {
    approvalMode: string;
    policySources: ('global' | 'workspace')[];
    conflictCount: number;
    recentConfirmations: number;
    recentDenials: number;
    topDeniedTools: string[];
    activeModel: string;
    activeProfile: string;
    policyTiers: string[];
}

async function readJsonFile(path: string): Promise<unknown> {
    try {
        const content = await readFile(path, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

export async function GET() {
    try {
        const globalConfigPath = join(homedir(), '.gemini', 'settings.json');
        const workspaceConfigPath = join(process.cwd(), '.gemini', 'settings.json');
        const telemetryPath = join(process.cwd(), '.gemini', 'telemetry.json');

        const [globalConfig, workspaceConfig, telemetry] = await Promise.all([
            readJsonFile(globalConfigPath),
            readJsonFile(workspaceConfigPath),
            readJsonFile(telemetryPath),
        ]);

        const g = (globalConfig as Record<string, unknown>) ?? {};
        const w = (workspaceConfig as Record<string, unknown>) ?? {};
        const t = (telemetry as Record<string, unknown>) ?? {};

        const sources: ('global' | 'workspace')[] = [];
        if (globalConfig) sources.push('global');
        if (workspaceConfig) sources.push('workspace');

        // Workspace overrides global
        const rawModel = w.model ?? g.model ?? 'gemini-2.0-flash';
        const activeModel = (typeof rawModel === 'object' && rawModel !== null ? (rawModel as any).name : rawModel) as string;

        const rawProfile = w.profile ?? g.profile ?? 'default';
        const activeProfile = (typeof rawProfile === 'object' && rawProfile !== null ? (rawProfile as any).name : rawProfile) as string;

        const approvalMode = (w.approvalMode ?? g.approvalMode ?? 'default') as string;

        // Check for policy conflicts (approval mode differs between global & workspace)
        const conflictCount =
            globalConfig && workspaceConfig && g.approvalMode && w.approvalMode && g.approvalMode !== w.approvalMode
                ? 1
                : 0;

        // Telemetry fields (best-effort)
        const toolCalls = (t.tool_calls as Record<string, unknown>) ?? {};
        const approvalStats = (t.approval_stats as Record<string, unknown>) ?? {};
        const recentConfirmations = Number(approvalStats.confirmations ?? 0);
        const recentDenials = Number(approvalStats.denials ?? 0);

        // Top denied tools
        const deniedTools = (approvalStats.denied_tools as Record<string, number>) ?? {};
        const topDeniedTools = Object.entries(deniedTools)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name]) => name);

        // Policy tiers
        const policyTiers = ['built-in', 'user-defined'];
        if (workspaceConfig) policyTiers.push('workspace-defined');

        const data: GovernanceSummaryView = {
            approvalMode,
            policySources: sources,
            conflictCount,
            recentConfirmations,
            recentDenials,
            topDeniedTools,
            activeModel,
            activeProfile,
            policyTiers,
        };

        return NextResponse.json(data);
    } catch (err) {
        console.error('[governance/summary]', err);
        return NextResponse.json(
            {
                approvalMode: 'unknown',
                policySources: [],
                conflictCount: 0,
                recentConfirmations: 0,
                recentDenials: 0,
                topDeniedTools: [],
                activeModel: 'unknown',
                activeProfile: 'default',
                policyTiers: ['built-in'],
            },
            { status: 200 }
        );
    }
}
