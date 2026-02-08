import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const messages = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC').all(id);
    
    // Parse stats JSON
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
     db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
     // Messages are cascaded due to schema, but better-sqlite3 doesn't enable FK by default unless PRAGMA is run.
     // Let's explicitly delete messages to be safe or run PRAGMA.
     db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
     
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
