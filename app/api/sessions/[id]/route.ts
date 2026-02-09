import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { ensureUserId } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await ensureUserId();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check ownership
    if (session.user_id && session.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Auto-claim legacy session if unowned
    if (!session.user_id) {
      db.prepare('UPDATE sessions SET user_id = ? WHERE id = ?').run(userId, id);
      session.user_id = userId;
    }

    const messages = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC').all(id);
    
    // Parse stats JSON
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsedMessages = messages.map((msg: any) => ({
      ...msg,
      stats: msg.stats ? JSON.parse(msg.stats) : undefined
    }));

    return NextResponse.json({ session, messages: parsedMessages });
  } catch (error) {
    console.error('Failed to fetch session:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
     const { id } = await params;
     const userId = await ensureUserId();

     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     const session = db.prepare('SELECT user_id FROM sessions WHERE id = ?').get(id) as any;

     if (session) {
       // Only allow deletion if user owns it or it's unowned
       if (session.user_id && session.user_id !== userId) {
         return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
       }

       db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
       // Messages are cascaded due to schema, but better-sqlite3 doesn't enable FK by default unless PRAGMA is run.
       // Let's explicitly delete messages to be safe or run PRAGMA.
       db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
     }
     
     // TODO: Also delete from gemini-cli?
     // We can try to run `gemini --delete-session` but that takes an index.
     // Since mapping UUID to index is hard without listing first, maybe we skip this for now.
     // The CLI sessions will accumulate but that's acceptable for now.
     
     return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
