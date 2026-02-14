import { NextRequest, NextResponse } from 'next/server';
import { queueMessage } from '@/lib/db';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const stats = queueMessage.getStats(sessionId);
    const pending = queueMessage.getPending(sessionId);

    return NextResponse.json({
      stats,
      currentMessage: pending || null,
      isPaused: false // Could be extended with a pause state
    });
  } catch (error) {
    console.error('[queue/status/api] Failed to get queue status:', error);
    return NextResponse.json({ error: 'Failed to get queue status' }, { status: 500 });
  }
}
