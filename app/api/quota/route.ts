
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';

export async function GET() {
    try {
        const core = CoreService.getInstance();
        const quota = await core.getQuota();

        return NextResponse.json({ quota });
    } catch (error) {
        console.error('Error fetching quota:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
