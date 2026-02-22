import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json().catch(() => ({} as { branch?: unknown }));
        const branch = typeof body.branch === 'string' ? body.branch : null;

        const result = db
            .prepare('UPDATE sessions SET branch = ?, updated_at = ? WHERE id = ?')
            .run(branch, Date.now(), id);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, branch });
    } catch (error) {
        console.error('Failed to update session branch:', error);
        return NextResponse.json({ error: 'Failed to update session branch' }, { status: 500 });
    }
}
