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
  if (!core.config || core.config.getSessionId() !== sessionId) {
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
