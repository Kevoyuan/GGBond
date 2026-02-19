import { NextResponse } from 'next/server';
import { getToolsConfig, getBuiltinTools, updateToolsConfig } from '@/lib/gemini-service';

export async function GET() {
    try {
        const config = await getToolsConfig();
        const builtinTools = await getBuiltinTools();

        // Check for headless env var as override
        const isHeadless = process.env.GEMINI_HEADLESS === '1' ||
            process.env.GEMINI_HEADLESS === 'true' ||
            config.headless === true ||
            config.headless === 'true';

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
                headless: isHeadless,
                shell: config.shell || {},
            },
        });
    } catch (error) {
        console.error('Failed to read tools config:', error);
        return NextResponse.json({ error: 'Failed to read tools config' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const updates = await req.json();

        // Validate allowed fields
        const allowedFields = ['sandbox', 'approvalMode', 'headless', 'core', 'exclude', 'allowed', 'shell'];
        const sanitizedUpdates: Record<string, unknown> = {};

        for (const key of allowedFields) {
            if (key in updates) {
                sanitizedUpdates[key] = updates[key];
            }
        }

        // Handle sandbox mode
        if (sanitizedUpdates.sandbox) {
            if (!['none', 'docker'].includes(sanitizedUpdates.sandbox as string)) {
                return NextResponse.json({ error: 'Invalid sandbox mode' }, { status: 400 });
            }
        }

        // Handle headless mode
        if (sanitizedUpdates.headless !== undefined) {
            if (typeof sanitizedUpdates.headless !== 'boolean') {
                sanitizedUpdates.headless = sanitizedUpdates.headless === 'true';
            }
        }

        // Update settings
        const updatedConfig = await updateToolsConfig(sanitizedUpdates);

        return NextResponse.json({
            success: true,
            config: {
                sandbox: updatedConfig.sandbox || 'none',
                approvalMode: updatedConfig.approvalMode || 'default',
                headless: updatedConfig.headless,
                shell: updatedConfig.shell || {},
            },
        });
    } catch (error) {
        console.error('Failed to update tools config:', error);
        return NextResponse.json({ error: 'Failed to update tools config' }, { status: 500 });
    }
}
