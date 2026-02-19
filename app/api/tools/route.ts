import { NextResponse } from 'next/server';
import { getToolsConfig, getBuiltinTools } from '@/lib/gemini-service';

export async function GET() {
    try {
        const config = await getToolsConfig();
        const builtinTools = await getBuiltinTools();

        // Merge built-in tools with config status
        const tools = builtinTools.map(tool => {
            const isExcluded = config.exclude?.some(e => e.startsWith(tool.name)) || false;
            const isAllowed = config.allowed?.some(a => a.startsWith(tool.name)) || false;
            const isCore = config.core?.some(c => c.startsWith(tool.name)) || false;

            return {
                ...tool,
                enabled: !isExcluded,
                isCore,
                isAllowed,
                isExcluded,
            };
        });

        return NextResponse.json({
            tools,
            config: {
                sandbox: config.sandbox || 'none',
                approvalMode: config.approvalMode || 'default',
                shell: config.shell || {},
            },
        });
    } catch (error) {
        console.error('Failed to read tools config:', error);
        return NextResponse.json({ error: 'Failed to read tools config' }, { status: 500 });
    }
}
