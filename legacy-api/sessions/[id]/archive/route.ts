import { NextResponse } from '@/src-sidecar/mock-next-server';
import { archiveSession } from '@/lib/session-crud';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { archived } = body;

    const result = archiveSession(id, archived);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to archive session:', error);
    return NextResponse.json({ error: 'Failed to archive session' }, { status: 500 });
  }
}
