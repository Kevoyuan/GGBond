import { NextResponse } from 'next/server';
import {
    getGeminiIgnoreConfig,
    saveGeminiIgnoreConfig,
    parseGeminiIgnoreFile,
} from '@/lib/config-service';

// GET /api/config/geminiignore - Get geminiignore config
export async function GET() {
    try {
        const config = await getGeminiIgnoreConfig();
        return NextResponse.json(config);
    } catch (error) {
        console.error('Failed to get geminiignore config:', error);
        return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
    }
}

// PUT /api/config/geminiignore - Save geminiignore config
export async function PUT(req: Request) {
    try {
        const config = await req.json();
        await saveGeminiIgnoreConfig(config);
        return NextResponse.json(config);
    } catch (error) {
        console.error('Failed to save geminiignore config:', error);
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }
}

// POST /api/config/geminiignore/parse - Parse .geminiignore file from project
export async function POST(req: Request) {
    try {
        const { projectPath } = await req.json();
        const patterns = await parseGeminiIgnoreFile(projectPath);
        return NextResponse.json({ patterns });
    } catch (error) {
        console.error('Failed to parse .geminiignore file:', error);
        return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 });
    }
}
