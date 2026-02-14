import { NextRequest, NextResponse } from 'next/server';
import db, { queueMessage, QueueMessage } from '@/lib/db';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');
  const includeStats = searchParams.get('stats') === 'true';

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const messages = queueMessage.getBySession(sessionId);
    const stats = includeStats ? queueMessage.getStats(sessionId) : null;

    return NextResponse.json({
      messages,
      stats
    });
  } catch (error) {
    console.error('[queue/api] Failed to get queue messages:', error);
    return NextResponse.json({ error: 'Failed to get queue messages' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, content, images, priority = 0 } = await req.json();

    if (!sessionId || !content) {
      return NextResponse.json({ error: 'sessionId and content are required' }, { status: 400 });
    }

    const id = queueMessage.add(sessionId, content, images, priority);

    return NextResponse.json({
      success: true,
      id,
      message: 'Message added to queue'
    });
  } catch (error) {
    console.error('[queue/api] Failed to add to queue:', error);
    return NextResponse.json({ error: 'Failed to add message to queue' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    const { id, sessionId } = await req.json();

    if (!id && !sessionId) {
      return NextResponse.json({ error: 'id or sessionId is required' }, { status: 400 });
    }

    switch (action) {
      case 'cancel':
        if (id) {
          queueMessage.cancel(id);
        } else if (sessionId) {
          // Cancel all pending/processing messages
          const messages = queueMessage.getBySession(sessionId);
          for (const msg of messages) {
            if (msg.status === 'pending' || msg.status === 'processing') {
              queueMessage.cancel(msg.id);
            }
          }
        }
        break;

      case 'retry':
        if (id) {
          const msg = queueMessage.getById(id);
          if (msg && (msg.status === 'failed' || msg.status === 'cancelled')) {
            queueMessage.updateStatus(id, 'pending', undefined, undefined);
          }
        }
        break;

      case 'clear':
        if (sessionId) {
          queueMessage.clear(sessionId);
        }
        break;

      case 'clearCompleted':
        if (sessionId) {
          queueMessage.clear(sessionId, 'completed');
        }
        break;

      case 'clearFailed':
        if (sessionId) {
          queueMessage.clear(sessionId, 'failed');
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[queue/api] Failed to perform action:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}
