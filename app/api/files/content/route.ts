import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.exe', '.dll', '.so', '.dylib',
    '.db', '.sqlite', '.sqlite3',
]);

function getLanguage(ext: string): string {
    const map: Record<string, string> = {
        '.ts': 'typescript', '.tsx': 'tsx',
        '.js': 'javascript', '.jsx': 'jsx',
        '.py': 'python',
        '.md': 'markdown',
        '.json': 'json',
        '.css': 'css', '.scss': 'scss',
        '.html': 'html',
        '.yaml': 'yaml', '.yml': 'yaml',
        '.sh': 'bash', '.zsh': 'bash',
        '.sql': 'sql',
        '.rs': 'rust', '.go': 'go',
        '.java': 'java', '.kt': 'kotlin',
        '.rb': 'ruby',
        '.toml': 'toml',
        '.xml': 'xml',
        '.txt': 'plaintext',
        '.env': 'plaintext',
        '.gitignore': 'plaintext',
        '.ref': 'plaintext',
        '.sref': 'plaintext',
        '.mjs': 'javascript', '.cjs': 'javascript',
    };
    return map[ext] || 'plaintext';
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { path: filePath, content } = body;

        if (!filePath) {
            return NextResponse.json({ error: 'path parameter is required' }, { status: 400 });
        }

        if (content === undefined) {
            return NextResponse.json({ error: 'content parameter is required' }, { status: 400 });
        }

        const ext = path.extname(filePath).toLowerCase();

        if (BINARY_EXTENSIONS.has(ext)) {
            return NextResponse.json({ error: 'Cannot edit binary files' }, { status: 400 });
        }

        await fs.writeFile(filePath, content, 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('File save API Error:', error);
        return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
        return NextResponse.json({ error: 'path parameter is required' }, { status: 400 });
    }

    try {
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
            return NextResponse.json({ error: 'Path is a directory' }, { status: 400 });
        }

        if (stats.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                error: 'File too large',
                size: stats.size,
                maxSize: MAX_FILE_SIZE
            }, { status: 413 });
        }

        const ext = path.extname(filePath).toLowerCase();

        if (BINARY_EXTENSIONS.has(ext)) {
            return NextResponse.json({
                error: 'Binary file',
                extension: ext
            }, { status: 415 });
        }

        const content = await fs.readFile(filePath, 'utf-8');
        const language = getLanguage(ext);

        return NextResponse.json({
            content,
            language,
            size: stats.size,
            name: path.basename(filePath),
            path: filePath,
        });
    } catch (error) {
        console.error('File content API Error:', error);
        return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
    }
}
