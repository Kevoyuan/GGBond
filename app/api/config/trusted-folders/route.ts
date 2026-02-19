import { NextResponse } from 'next/server';
import {
    getTrustedFolders,
    saveTrustedFolders,
    addTrustedFolder,
    removeTrustedFolder,
} from '@/lib/config-service';

// GET /api/config/trusted-folders - Get all trusted folders
export async function GET() {
    try {
        const folders = await getTrustedFolders();
        return NextResponse.json({ folders });
    } catch (error) {
        console.error('Failed to get trusted folders:', error);
        return NextResponse.json({ error: 'Failed to get folders' }, { status: 500 });
    }
}

// PUT /api/config/trusted-folders - Save all trusted folders
export async function PUT(req: Request) {
    try {
        const { folders } = await req.json();
        await saveTrustedFolders(folders);
        return NextResponse.json({ folders });
    } catch (error) {
        console.error('Failed to save trusted folders:', error);
        return NextResponse.json({ error: 'Failed to save folders' }, { status: 500 });
    }
}

// POST /api/config/trusted-folders - Add a new trusted folder
export async function POST(req: Request) {
    try {
        const folder = await req.json();
        const newFolder = await addTrustedFolder(folder);
        return NextResponse.json({ folder: newFolder });
    } catch (error) {
        console.error('Failed to add trusted folder:', error);
        return NextResponse.json({ error: 'Failed to add folder' }, { status: 500 });
    }
}

// DELETE /api/config/trusted-folders - Remove a trusted folder
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Missing folder id' }, { status: 400 });
        }
        await removeTrustedFolder(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to remove trusted folder:', error);
        return NextResponse.json({ error: 'Failed to remove folder' }, { status: 500 });
    }
}
