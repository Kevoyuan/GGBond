import { NextResponse } from 'next/server';
import { getMCPServers, addMCPServer, removeMCPServer } from '@/lib/gemini-service';

export async function GET() {
    try {
        const servers = await getMCPServers();
        return NextResponse.json(servers);
    } catch (error) {
        console.error('Failed to read MCP servers:', error);
        return NextResponse.json({ error: 'Failed to read MCP servers' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { action, name, config } = await req.json();

        if (!name) {
            return NextResponse.json({ error: 'Server name required' }, { status: 400 });
        }

        if (action === 'add') {
            await addMCPServer(name, config || {});
            return NextResponse.json({ success: true });
        } else if (action === 'remove') {
            await removeMCPServer(name);
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Invalid action. Use "add" or "remove"' }, { status: 400 });
        }
    } catch (error) {
        console.error('Failed to manage MCP server:', error);
        return NextResponse.json({ error: 'Failed to manage MCP server' }, { status: 500 });
    }
}
