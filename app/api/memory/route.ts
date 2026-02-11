
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';

export async function GET() {
    try {
        const core = CoreService.getInstance();
        const files = core.getMemoryFiles();

        return NextResponse.json({ files });
    } catch (error) {
        console.error('Error fetching memory files:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST() {
    try {
        const core = CoreService.getInstance();
        await core.refreshMemory();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error refreshing memory:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
