import { NextResponse } from '@/src-sidecar/mock-next-server';
import { updateSessionBranch } from '@/lib/session-crud';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({} as { branch?: unknown }));
    const branch = typeof body.branch === 'string' ? body.branch : null;

    const result = updateSessionBranch(id, branch);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to update session branch:', error);
    return NextResponse.json({ error: 'Failed to update session branch' }, { status: 500 });
  }
}
