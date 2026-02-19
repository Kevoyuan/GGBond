import { NextResponse } from 'next/server';
import {
    getCustomCommands,
    saveCustomCommands,
    addCustomCommand,
    updateCustomCommand,
    removeCustomCommand,
} from '@/lib/config-service';

// GET /api/config/custom-commands - Get all custom commands
export async function GET() {
    try {
        const commands = await getCustomCommands();
        return NextResponse.json({ commands });
    } catch (error) {
        console.error('Failed to get custom commands:', error);
        return NextResponse.json({ error: 'Failed to get commands' }, { status: 500 });
    }
}

// PUT /api/config/custom-commands - Save all custom commands
export async function PUT(req: Request) {
    try {
        const { commands } = await req.json();
        await saveCustomCommands(commands);
        return NextResponse.json({ commands });
    } catch (error) {
        console.error('Failed to save custom commands:', error);
        return NextResponse.json({ error: 'Failed to save commands' }, { status: 500 });
    }
}

// POST /api/config/custom-commands - Add a new custom command
export async function POST(req: Request) {
    try {
        const command = await req.json();
        const newCommand = await addCustomCommand(command);
        return NextResponse.json({ command: newCommand });
    } catch (error) {
        console.error('Failed to add custom command:', error);
        return NextResponse.json({ error: 'Failed to add command' }, { status: 500 });
    }
}

// PATCH /api/config/custom-commands - Update a custom command
export async function PATCH(req: Request) {
    try {
        const { id, ...updates } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'Missing command id' }, { status: 400 });
        }
        const updated = await updateCustomCommand(id, updates);
        if (!updated) {
            return NextResponse.json({ error: 'Command not found' }, { status: 404 });
        }
        return NextResponse.json({ command: updated });
    } catch (error) {
        console.error('Failed to update custom command:', error);
        return NextResponse.json({ error: 'Failed to update command' }, { status: 500 });
    }
}

// DELETE /api/config/custom-commands - Remove a custom command
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Missing command id' }, { status: 400 });
        }
        await removeCustomCommand(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to remove custom command:', error);
        return NextResponse.json({ error: 'Failed to remove command' }, { status: 500 });
    }
}
