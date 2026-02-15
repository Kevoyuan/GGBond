import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

export async function GET(req: NextRequest) {
    const path = req.nextUrl.searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'path parameter is required' }, { status: 400 });
    }

    if (!existsSync(path)) {
        return NextResponse.json({ error: 'Path does not exist' }, { status: 404 });
    }

    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: path,
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();

        return NextResponse.json({ branch });
    } catch {
        // Not a git repo or git not installed
        return NextResponse.json({ branch: null });
    }
}
