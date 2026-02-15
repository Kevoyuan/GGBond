import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';

export async function POST(req: Request) {
    try {
        const { path: filePath } = await req.json();

        if (!filePath) {
            return NextResponse.json({ error: 'Path is required' }, { status: 400 });
        }

        try {
            await fs.access(filePath);
        } catch {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Spawn 'code' command to open the file
        spawn('code', [filePath], {
            detached: true,
            stdio: 'ignore'
        }).unref();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to open file:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
