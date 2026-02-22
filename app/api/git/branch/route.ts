import { NextRequest, NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';

function runGit(path: string, args: string[]) {
    return execFileSync('git', args, {
        cwd: path,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
}

export async function GET(req: NextRequest) {
    let path = req.nextUrl.searchParams.get('path');
    const includeList = req.nextUrl.searchParams.get('list') === '1';

    if (!path || path === 'Default') {
        path = process.cwd();
    }

    if (!existsSync(path)) {
        return NextResponse.json({ error: 'Path does not exist' }, { status: 404 });
    }

    try {
        const branch = runGit(path, ['rev-parse', '--abbrev-ref', 'HEAD']);

        if (!includeList) {
            return NextResponse.json({ branch });
        }

        const listRaw = runGit(path, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']);
        const branches = listRaw
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean);

        return NextResponse.json({ branch, branches });
    } catch {
        // Not a git repo or git not installed
        return NextResponse.json({ branch: null, branches: [] });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        let path = typeof body?.path === 'string' ? body.path : '';
        const branch = typeof body?.branch === 'string' ? body.branch.trim() : '';

        if (!path || path === 'Default') {
            path = process.cwd();
        }
        if (!branch) {
            return NextResponse.json({ error: 'branch is required' }, { status: 400 });
        }
        if (!existsSync(path)) {
            return NextResponse.json({ error: 'Path does not exist' }, { status: 404 });
        }

        try {
            runGit(path, ['rev-parse', '--verify', `refs/heads/${branch}`]);
        } catch {
            return NextResponse.json({ error: `Branch "${branch}" does not exist locally` }, { status: 400 });
        }

        runGit(path, ['checkout', branch]);
        const currentBranch = runGit(path, ['rev-parse', '--abbrev-ref', 'HEAD']);
        const listRaw = runGit(path, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']);
        const branches = listRaw
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean);

        return NextResponse.json({ branch: currentBranch, branches });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to switch branch';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
