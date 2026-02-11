
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';

export async function GET() {
    try {
        const core = CoreService.getInstance();
        const agents = core.getAgents();

        return NextResponse.json({ agents });
    } catch (error) {
        console.error('Error fetching agents:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
