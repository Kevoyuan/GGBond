
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';

export async function GET() {
    try {
        const core = CoreService.getInstance();
        const servers = core.getMcpServers();

        return NextResponse.json({ servers });
    } catch (error) {
        console.error('Error fetching MCP servers:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
