import { NextRequest, NextResponse } from 'next/server';
import { chatSnapshots } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id') || undefined;

    const snapshots = chatSnapshots.list(sessionId);

    return NextResponse.json({
      snapshots: snapshots.map(s => ({
        id: s.id,
        session_id: s.session_id,
        tag: s.tag,
        title: s.title,
        message_count: s.message_count,
        session_title: (s as any).session_title,
        created_at: s.created_at,
        created_at_formatted: new Date(s.created_at).toLocaleString()
      }))
    });
  } catch (error) {
    console.error('[chat/snapshots] Failed to list snapshots:', error);
    return NextResponse.json({ error: 'Failed to list snapshots' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, session_id, tag, title, message_count } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    switch (action) {
      case 'save': {
        if (!tag) {
          return NextResponse.json({ error: 'tag is required for save action' }, { status: 400 });
        }

        // Validate tag format (alphanumeric, dash, underscore)
        if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
          return NextResponse.json(
            { error: 'Tag must contain only alphanumeric characters, dashes, and underscores' },
            { status: 400 }
          );
        }

        chatSnapshots.save(session_id, tag, title, message_count);

        return NextResponse.json({
          success: true,
          message: `Snapshot '${tag}' saved successfully`,
          snapshot: { session_id, tag, title, message_count }
        });
      }

      case 'delete': {
        if (!tag) {
          return NextResponse.json({ error: 'tag is required for delete action' }, { status: 400 });
        }

        const existing = chatSnapshots.get(session_id, tag);
        if (!existing) {
          return NextResponse.json({ error: `Snapshot '${tag}' not found` }, { status: 404 });
        }

        chatSnapshots.delete(session_id, tag);

        return NextResponse.json({
          success: true,
          message: `Snapshot '${tag}' deleted successfully`
        });
      }

      case 'list': {
        const snapshots = chatSnapshots.list(session_id);
        return NextResponse.json({
          snapshots: snapshots.map(s => ({
            id: s.id,
            session_id: s.session_id,
            tag: s.tag,
            title: s.title,
            message_count: s.message_count,
            session_title: (s as any).session_title,
            created_at: s.created_at,
            created_at_formatted: new Date(s.created_at).toLocaleString()
          }))
        });
      }

      case 'resume': {
        if (!tag) {
          return NextResponse.json({ error: 'tag is required for resume action' }, { status: 400 });
        }

        const snapshot = chatSnapshots.get(session_id, tag);
        if (!snapshot) {
          return NextResponse.json({ error: `Snapshot '${tag}' not found` }, { status: 404 });
        }

        // Create a new session and copy messages from the snapshot's session
        const newSessionId = crypto.randomUUID();
        const now = Date.now();

        // Import db here to create the new session and copy messages
        const { default: db } = await import('@/lib/db');

        // Insert new session
        db.prepare(`
          INSERT INTO sessions (id, title, created_at, updated_at, workspace, branch)
          SELECT ?, ?, ?, updated_at, workspace, branch
          FROM sessions WHERE id = ?
        `).run(newSessionId, `[Resume] ${snapshot.title || snapshot.tag}`, now, snapshot.session_id);

        // Copy messages from the original session to the new session
        db.prepare(`
          INSERT INTO messages (session_id, role, content, stats, thought, citations, images, parent_id, created_at)
          SELECT ?, role, content, stats, thought, citations, images, parent_id, created_at
          FROM messages WHERE session_id = ?
        `).run(newSessionId, snapshot.session_id);

        return NextResponse.json({
          success: true,
          new_session_id: newSessionId,
          message: `Resumed from snapshot '${tag}'`
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Supported actions: save, delete, list` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[chat/snapshots] API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
