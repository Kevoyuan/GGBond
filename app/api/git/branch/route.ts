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

type FileDiffStat = {
    file: string;
    added: number;
    removed: number;
    isUntracked?: boolean;
};

type UncommittedStats = {
    added: number;
    removed: number;
    untracked: number;
    hasChanges: boolean;
    files: FileDiffStat[];
};

function parseNumstat(raw: string): FileDiffStat[] {
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const parts = line.split('\t');
            if (parts.length < 3) return null;
            const added = parseInt(parts[0], 10) || 0;
            const removed = parseInt(parts[1], 10) || 0;
            const file = parts[2];
            return { file, added, removed };
        })
        .filter((item): item is FileDiffStat => item !== null);
}

function getUncommittedStats(path: string): UncommittedStats {
    let unstagedRaw = '';
    let stagedRaw = '';
    let untrackedRaw = '';

    try {
        unstagedRaw = runGit(path, ['diff', '--numstat']);
    } catch {
        unstagedRaw = '';
    }
    try {
        stagedRaw = runGit(path, ['diff', '--cached', '--numstat']);
    } catch {
        stagedRaw = '';
    }
    try {
        untrackedRaw = runGit(path, ['ls-files', '--others', '--exclude-standard']);
    } catch {
        untrackedRaw = '';
    }

    const unstagedFiles = parseNumstat(unstagedRaw);
    const stagedFiles = parseNumstat(stagedRaw);
    
    // Merge staged and unstaged
    const fileMap = new Map<string, FileDiffStat>();
    [...unstagedFiles, ...stagedFiles].forEach(f => {
        const existing = fileMap.get(f.file);
        if (existing) {
            existing.added += f.added;
            existing.removed += f.removed;
        } else {
            fileMap.set(f.file, { ...f });
        }
    });

    const untrackedFiles = untrackedRaw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map(file => ({ file, added: 0, removed: 0, isUntracked: true }));

    untrackedFiles.forEach(f => {
        if (!fileMap.has(f.file)) {
            fileMap.set(f.file, f);
        }
    });

    const files = Array.from(fileMap.values());
    const added = files.reduce((sum, f) => sum + f.added, 0);
    const removed = files.reduce((sum, f) => sum + f.removed, 0);
    const untrackedCount = untrackedFiles.length;
    const hasChanges = files.length > 0;

    return {
        added,
        removed,
        untracked: untrackedCount,
        hasChanges,
        files
    };
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
        const uncommitted = getUncommittedStats(path);

        if (!includeList) {
            return NextResponse.json({ branch, uncommitted });
        }

        const listRaw = runGit(path, ['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads']);
        const branches = listRaw
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean);

        return NextResponse.json({ branch, branches, uncommitted });
    } catch {
        // Not a git repo or git not installed
        return NextResponse.json({ branch: null, branches: [], uncommitted: null });
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
        const uncommitted = getUncommittedStats(path);
        const listRaw = runGit(path, ['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads']);
        const branches = listRaw
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean);

        return NextResponse.json({ branch: currentBranch, branches, uncommitted });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to switch branch';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
