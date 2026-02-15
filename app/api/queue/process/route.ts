import { NextRequest, NextResponse } from 'next/server';
import { queueMessage } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Get the next pending message
    const pending = queueMessage.getPending(sessionId);

    if (!pending) {
      return NextResponse.json({
        hasNext: false,
        message: 'No pending messages in queue'
      });
    }

    // Mark as processing
    queueMessage.updateStatus(pending.id, 'processing');

    return NextResponse.json({
      hasNext: true,
      message: pending,
      processedId: pending.id
    });
  } catch (error) {
    console.error('[queue/process/api] Failed to process queue:', error);
    return NextResponse.json({ error: 'Failed to process queue' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { queueItemId, resultMessageId, error, status } = await req.json();

    if (!queueItemId) {
      return NextResponse.json({ error: 'queueItemId is required' }, { status: 400 });
    }

    const resolvedStatus = status || (error ? 'failed' : 'completed');
    queueMessage.updateStatus(queueItemId, resolvedStatus, resultMessageId || undefined, error);

    return NextResponse.json({
      success: true,
      status: resolvedStatus
    });
  } catch (error) {
    console.error('[queue/process/api] Failed to update status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
