import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CoreService } from '@/lib/core-service';

interface MemoryAction {
    action?: 'refresh' | 'read' | 'create' | 'update' | 'delete';
    path?: string;
    workspacePath?: string;
    content?: string;
}

const DEFAULT_MEMORY_TEMPLATE = `# GEMINI.md

## Project Context
- Describe this project's purpose.
- Document architecture assumptions.

## Coding Preferences
- Preferred language/style.
- Testing expectations.

## Important Constraints
- List safety and deployment constraints here.
`;

const isMemoryFilePath = (filePath: string) =>
    path.basename(filePath).toLowerCase() === 'gemini.md';

const resolveWorkspacePath = (workspacePath?: string) =>
    workspacePath && workspacePath.trim()
        ? workspacePath.trim()
        : process.cwd();

const resolveMemoryPath = (filePath: string, workspacePath?: string) => {
    const candidate = filePath.trim();
    if (path.isAbsolute(candidate)) {
        return candidate;
    }
    return path.resolve(resolveWorkspacePath(workspacePath), candidate);
};

const resolveCreateTargetPath = (payload: MemoryAction) => {
    if (payload.path && payload.path.trim()) {
        return resolveMemoryPath(payload.path, payload.workspacePath);
    }
    const workspacePath = resolveWorkspacePath(payload.workspacePath);
    return path.join(workspacePath, 'GEMINI.md');
};

export async function GET(req: Request) {
    try {
        const core = CoreService.getInstance();
        const { searchParams } = new URL(req.url);
        const filePath = searchParams.get('path');
        const includeContent = searchParams.get('content') === '1';
        const workspacePath = searchParams.get('workspacePath') || searchParams.get('workspace') || undefined;

        if (includeContent && filePath) {
            const resolvedFilePath = resolveMemoryPath(filePath, workspacePath);
            if (!isMemoryFilePath(resolvedFilePath)) {
                return NextResponse.json({ error: 'Only GEMINI.md files are editable.' }, { status: 400 });
            }

            const content = await fs.readFile(resolvedFilePath, 'utf-8');
            return NextResponse.json({ path: resolvedFilePath, content });
        }

        const loadedFiles = core.getMemoryFiles();
        const projectMemoryPath = path.join(resolveWorkspacePath(workspacePath), 'GEMINI.md');
        let projectFiles: string[] = [];

        try {
            const stat = await fs.stat(projectMemoryPath);
            if (stat.isFile()) {
                projectFiles = [projectMemoryPath];
            }
        } catch {
            projectFiles = [];
        }

        const files = Array.from(new Set([...projectFiles, ...loadedFiles]));
        return NextResponse.json({ files, loadedFiles, projectFiles });
    } catch (error) {
        console.error('Error fetching memory files:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const core = CoreService.getInstance();
        const body = (await req.json().catch(() => ({}))) as MemoryAction;
        const action = body.action || 'refresh';

        if (action === 'refresh') {
            await core.refreshMemory();
            return NextResponse.json({ success: true });
        }

        if (action === 'read') {
            const filePath = body.path?.trim();
            if (!filePath) {
                return NextResponse.json({ error: 'Missing memory file path' }, { status: 400 });
            }
            const resolvedFilePath = resolveMemoryPath(filePath, body.workspacePath);
            if (!isMemoryFilePath(resolvedFilePath)) {
                return NextResponse.json({ error: 'Only GEMINI.md files are editable.' }, { status: 400 });
            }
            const content = await fs.readFile(resolvedFilePath, 'utf-8');
            return NextResponse.json({ success: true, path: resolvedFilePath, content });
        }

        if (action === 'create') {
            const targetPath = resolveCreateTargetPath(body);
            if (!isMemoryFilePath(targetPath)) {
                return NextResponse.json({ error: 'Only GEMINI.md files can be created here.' }, { status: 400 });
            }

            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            const fileContent = typeof body.content === 'string' && body.content.trim()
                ? body.content
                : DEFAULT_MEMORY_TEMPLATE;
            await fs.writeFile(targetPath, fileContent, 'utf-8');
            await core.refreshMemory();
            return NextResponse.json({ success: true, path: targetPath });
        }

        if (action === 'update') {
            const filePath = body.path?.trim();
            if (!filePath) {
                return NextResponse.json({ error: 'Missing memory file path' }, { status: 400 });
            }
            const resolvedFilePath = resolveMemoryPath(filePath, body.workspacePath);
            if (!isMemoryFilePath(resolvedFilePath)) {
                return NextResponse.json({ error: 'Only GEMINI.md files are editable.' }, { status: 400 });
            }
            if (typeof body.content !== 'string') {
                return NextResponse.json({ error: 'Content must be a string' }, { status: 400 });
            }

            await fs.mkdir(path.dirname(resolvedFilePath), { recursive: true });
            await fs.writeFile(resolvedFilePath, body.content, 'utf-8');
            await core.refreshMemory();
            return NextResponse.json({ success: true, path: resolvedFilePath });
        }

        if (action === 'delete') {
            const filePath = body.path?.trim();
            if (!filePath) {
                return NextResponse.json({ error: 'Missing memory file path' }, { status: 400 });
            }
            const resolvedFilePath = resolveMemoryPath(filePath, body.workspacePath);
            if (!isMemoryFilePath(resolvedFilePath)) {
                return NextResponse.json({ error: 'Only GEMINI.md files can be deleted here.' }, { status: 400 });
            }

            await fs.unlink(resolvedFilePath);
            await core.refreshMemory();
            return NextResponse.json({ success: true, path: resolvedFilePath });
        }

        return NextResponse.json({ error: 'Unsupported memory action' }, { status: 400 });
    } catch (error) {
        console.error('Error handling memory operation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
