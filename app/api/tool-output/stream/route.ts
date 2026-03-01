import { NextRequest, NextResponse } from 'next/server';
import { CoreService, ToolExecutionOutputPayload } from '@/lib/core-service';

export const runtime = 'nodejs';

// Maximum number of events to keep in buffer
const MAX_EVENT_BUFFER = 100;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 }
    );
  }

  const core = CoreService.getInstance();

  // Verify session is initialized
  const serverSessionId = core.config?.getSessionId();
  console.log(`[tool-output/stream] Request sessionId: ${sessionId}, Server sessionId: ${serverSessionId}`);

  if (!core.config || serverSessionId !== sessionId) {
    console.log(`[tool-output/stream] Session validation failed: core.config exists: ${!!core.config}`);
    return NextResponse.json(
      { error: 'Session not initialized or mismatch' },
      { status: 400 }
    );
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to tool execution output
      const unsubscribe = core.subscribeToolExecutionOutput((payload: ToolExecutionOutputPayload) => {
        try {
          const eventData = JSON.stringify({
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            output: payload.output,
            isStderr: payload.isStderr,
            timestamp: payload.timestamp,
          });
          controller.enqueue(`data: ${eventData}\n\n`);
        } catch (error) {
          console.error('[tool-output/stream] Error sending event:', error);
        }
      });

      // Send initial connection event
      try {
        controller.enqueue(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);
      } catch (error) {
        console.error('[tool-output/stream] Error sending initial event:', error);
        unsubscribe();
        controller.close();
      }

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

// Lightweight HEAD handler for pre-flight session validation.
// The client uses this to detect a 400 (session mismatch) before opening an EventSource,
// since EventSource.onerror cannot distinguish HTTP status codes.
export async function HEAD(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new NextResponse(null, { status: 400 });
  }

  const core = CoreService.getInstance();
  const serverSessionId = core.config?.getSessionId();

  if (!core.config || serverSessionId !== sessionId) {
    return new NextResponse(null, { status: 400 });
  }

  return new NextResponse(null, { status: 200 });
}
