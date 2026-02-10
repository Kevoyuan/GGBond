
import { NextRequest, NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';

export async function POST(req: NextRequest) {
    try {
        const { correlationId, confirmed } = await req.json();

        if (!correlationId) {
            return NextResponse.json({ error: 'Missing correlationId' }, { status: 400 });
        }

        const core = CoreService.getInstance();
        core.submitConfirmation(correlationId, confirmed);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting confirmation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
