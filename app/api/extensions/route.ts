import { NextResponse } from 'next/server';
import { invalidateGeminiCommandCache, runGeminiCommand } from '@/lib/gemini-service';

type ExtensionItem = { name: string; description: string };

const EXTENSIONS_CACHE_TTL_MS = 5000;
let extensionsCache: { data: ExtensionItem[]; expiresAt: number } | null = null;
let extensionsInFlight: Promise<ExtensionItem[]> | null = null;

function invalidateExtensionsCache() {
    extensionsCache = null;
    extensionsInFlight = null;
    invalidateGeminiCommandCache(['extensions', 'list']);
}

export async function GET() {
    try {
        const now = Date.now();
        if (extensionsCache && extensionsCache.expiresAt > now) {
            return NextResponse.json(extensionsCache.data);
        }
        if (!extensionsInFlight) {
            extensionsInFlight = (async () => {
                const output = await runGeminiCommand(['extensions', 'list']);
                return output.trim().split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const parts = line.split(' - ');
                        return {
                            name: parts[0]?.trim() || line.trim(),
                            description: parts.slice(1).join(' - ').trim() || '',
                        };
                    });
            })().finally(() => {
                extensionsInFlight = null;
            });
        }
        const extensions = await extensionsInFlight;
        extensionsCache = { data: extensions, expiresAt: Date.now() + EXTENSIONS_CACHE_TTL_MS };
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
            invalidateExtensionsCache();
            return NextResponse.json({ success: true });
        } else if (action === 'uninstall' && name) {
            await runGeminiCommand(['extensions', 'uninstall', name]);
            invalidateExtensionsCache();
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
