import { NextResponse } from 'next/server';
import { getCustomTools, saveCustomTool, deleteCustomTool, type CustomToolDefinition } from '@/lib/gemini-service';

export async function GET() {
    try {
        const tools = await getCustomTools();
        return NextResponse.json({ tools });
    } catch (error) {
        console.error('Failed to read custom tools:', error);
        return NextResponse.json({ error: 'Failed to read custom tools' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const tool: CustomToolDefinition = await request.json();
        await saveCustomTool(tool);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save custom tool:', error);
        return NextResponse.json({ error: 'Failed to save custom tool' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Tool ID required' }, { status: 400 });
        }
        await deleteCustomTool(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete custom tool:', error);
        return NextResponse.json({ error: 'Failed to delete custom tool' }, { status: 500 });
    }
}
