import { NextRequest, NextResponse } from 'next/server';
import { writeTerminalInput } from '@/lib/terminal-registry';

export const runtime = 'nodejs';

type TerminalInputRequestBody = {
  runId: string;
  data: string;
};

export async function POST(req: NextRequest) {
  let body: TerminalInputRequestBody;

  try {
    body = (await req.json()) as TerminalInputRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const runId = body.runId;
  const data = body.data;

  if (typeof runId !== 'string' || !runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 });
  }

  if (typeof data !== 'string') {
    return NextResponse.json({ error: 'data is required and must be a string' }, { status: 400 });
  }

  try {
    const result = writeTerminalInput(runId, data);
    if (!result.found) {
      return NextResponse.json({ error: 'Terminal process not found or already exited' }, { status: 404 });
    }
    if (!result.written) {
      return NextResponse.json({ error: 'Process does not support input writing' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to write input',
      },
      { status: 500 }
    );
  }
}
