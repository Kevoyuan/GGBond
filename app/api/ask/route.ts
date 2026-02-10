
import { NextRequest, NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';

export async function POST(req: NextRequest) {
    try {
        const { correlationId, answers } = await req.json();

        if (!correlationId) {
            return NextResponse.json({ error: 'Missing correlationId' }, { status: 400 });
        }

        const core = CoreService.getInstance();
        core.submitQuestionResponse(correlationId, answers);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting question response:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
