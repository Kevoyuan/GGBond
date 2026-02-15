
import { NextRequest, NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import db from '@/lib/db';
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
        const deliveredToActiveCore = await core.submitConfirmation(
            correlationId,
            confirmed,
            normalizedOutcome,
            normalizedPayload
        );

        // In Next.js dev/runtime, /api/chat and /api/confirm can be served by different workers.
        // Queue fallback lets the active chat stream worker consume confirmations by correlation ID.
        if (!deliveredToActiveCore) {
            db.prepare(`
                INSERT INTO confirmation_queue (
                    correlation_id,
                    confirmed,
                    outcome,
                    payload,
                    created_at
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(correlation_id) DO UPDATE SET
                    confirmed = excluded.confirmed,
                    outcome = excluded.outcome,
                    payload = excluded.payload,
                    created_at = excluded.created_at
            `).run(
                correlationId,
                confirmed ? 1 : 0,
                normalizedOutcome ?? null,
                normalizedPayload ? JSON.stringify(normalizedPayload) : null,
                Date.now()
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting confirmation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
