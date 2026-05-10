import { NextResponse } from '@/src-sidecar/mock-next-server';
import { listSessions, createSession } from '@/lib/session-crud';

export async function GET() {
  try {
    return NextResponse.json(listSessions());
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspace, title } = body;
    const result = createSession(
      typeof workspace === 'string' ? workspace : '',
      typeof title === 'string' ? title : undefined,
    );

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to create session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
