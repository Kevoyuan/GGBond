
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';

export async function GET() {
    try {
        const core = CoreService.getInstance();
        const sessions = await core.listSessions();

        return NextResponse.json(sessions);
    } catch (error) {
        console.error('Error fetching core sessions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
