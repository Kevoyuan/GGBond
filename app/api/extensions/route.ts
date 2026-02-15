import { NextResponse } from 'next/server';
import { runGeminiCommand } from '@/lib/gemini-service';

export async function GET() {
    try {
        const output = await runGeminiCommand(['extensions', 'list']);
        // Parse the output: each line is typically "name - description"
        const extensions = output.trim().split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.split(' - ');
                return {
                    name: parts[0]?.trim() || line.trim(),
                    description: parts.slice(1).join(' - ').trim() || '',
                };
            });
        return NextResponse.json(extensions);
    } catch (error) {
        // If the command fails (e.g., no extensions), return empty list
        console.error('Failed to list extensions:', error);
        return NextResponse.json([]);
    }
}

export async function POST(req: Request) {
    try {
        const { action, name, source } = await req.json();

        if (action === 'install' && source) {
            await runGeminiCommand(['extensions', 'install', source]);
            return NextResponse.json({ success: true });
        } else if (action === 'uninstall' && name) {
            await runGeminiCommand(['extensions', 'uninstall', name]);
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Extension operation failed:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Operation failed'
        }, { status: 500 });
    }
}
