import { NextResponse } from 'next/server';
import {
    getFullConfig,
    saveFullConfig,
    getGeminiIgnoreConfig,
    saveGeminiIgnoreConfig,
    parseGeminiIgnoreFile,
    getTrustedFolders,
    saveTrustedFolders,
    addTrustedFolder,
    removeTrustedFolder,
    getCustomCommands,
    saveCustomCommands,
    addCustomCommand,
    updateCustomCommand,
    removeCustomCommand,
} from '@/lib/config-service';

// GET /api/config - Get all config
export async function GET() {
    try {
        const config = await getFullConfig();
        return NextResponse.json(config);
    } catch (error) {
        console.error('Failed to get config:', error);
        return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
    }
}

// PUT /api/config - Save all config
export async function PUT(req: Request) {
    try {
        const config = await req.json();
        const saved = await saveFullConfig(config);
        return NextResponse.json(saved);
    } catch (error) {
        console.error('Failed to save config:', error);
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }
}
