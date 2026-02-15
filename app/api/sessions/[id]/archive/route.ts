import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { archived } = body;

    if (typeof archived !== 'boolean') {
      return NextResponse.json({ error: 'Invalid archived value' }, { status: 400 });
    }

    db.prepare('UPDATE sessions SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id);

    return NextResponse.json({ success: true, archived });
  } catch (error) {
    console.error('Failed to archive session:', error);
    return NextResponse.json({ error: 'Failed to archive session' }, { status: 500 });
  }
}
