import { NextResponse } from 'next/server';
import { findGeminiMdFiles } from '@/lib/gemini-service';
import fsp from 'fs/promises';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const cwd = searchParams.get('cwd') || undefined;
        const files = await findGeminiMdFiles(cwd);
        return NextResponse.json(files);
    } catch (error) {
        console.error('Failed to read GEMINI.md files:', error);
        return NextResponse.json({ error: 'Failed to read GEMINI.md files' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { path: filePath, content } = await req.json();
        if (!filePath || typeof content !== 'string') {
            return NextResponse.json({ error: 'path and content required' }, { status: 400 });
        }
        await fsp.writeFile(filePath, content, 'utf-8');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to write GEMINI.md:', error);
        return NextResponse.json({ error: 'Failed to write file' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { path: filePath, content } = await req.json();
        if (!filePath || !content) {
            return NextResponse.json({ error: 'path and content required' }, { status: 400 });
        }
        await fsp.appendFile(filePath, '\n' + content, 'utf-8');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to append to GEMINI.md:', error);
        return NextResponse.json({ error: 'Failed to append to file' }, { status: 500 });
    }
}
