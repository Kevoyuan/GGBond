import { NextRequest, NextResponse } from 'next/server';
import { requestTerminalStop, type TerminalStopSignal } from '@/lib/terminal-registry';

export const runtime = 'nodejs';

type StopTerminalRequestBody = {
  runId?: unknown;
  signal?: unknown;
};

export async function POST(req: NextRequest) {
  let body: StopTerminalRequestBody;

  try {
    body = (await req.json()) as StopTerminalRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const runId = typeof body.runId === 'string' ? body.runId.trim() : '';
  if (!runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 });
  }

  const signal = body.signal === 'SIGINT' || body.signal === 'SIGTERM'
    ? body.signal as TerminalStopSignal
    : 'SIGTERM';

  const result = requestTerminalStop(runId, signal);
  if (!result.found) {
    return NextResponse.json({ error: 'No active process found for runId' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    runId,
    signal,
    signaled: result.signaled,
  });
}
