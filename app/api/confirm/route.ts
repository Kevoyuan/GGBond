
import { NextRequest, NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import { ToolConfirmationOutcome, ToolConfirmationPayload } from '@google/gemini-cli-core';

export async function POST(req: NextRequest) {
    try {
        const { correlationId, confirmed, outcome, payload } = await req.json();

        if (!correlationId) {
            return NextResponse.json({ error: 'Missing correlationId' }, { status: 400 });
        }

        const normalizedOutcome = typeof outcome === 'string'
            ? outcome as ToolConfirmationOutcome
            : undefined;
        const normalizedPayload = (payload && typeof payload === 'object')
            ? payload as ToolConfirmationPayload
            : undefined;

        const core = CoreService.getInstance();
        await core.submitConfirmation(correlationId, confirmed, normalizedOutcome, normalizedPayload);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting confirmation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
