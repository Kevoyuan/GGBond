import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { CoreService } from '@/lib/core-service';

export async function POST(req: Request) {
  try {
    const { action, sessionId, toolId, checkpointId, messageId, workspace, model } = await req.json();

    if (!action || !sessionId) {
      return NextResponse.json({ error: 'action and sessionId are required' }, { status: 400 });
    }

    const core = CoreService.getInstance();

    await core.initialize({
      sessionId,
      model: model || 'gemini-2.5-pro',
      cwd: (workspace && workspace !== 'Default') ? workspace : process.cwd(),
      approvalMode: 'default'
    });

    if (action === 'rewind') {
      const rewindResult = core.rewindLastUserMessage();
      if (!rewindResult.success) {
        return NextResponse.json({ error: rewindResult.error }, { status: 400 });
      }

      const lastUser = db.prepare(
        `SELECT id FROM messages
         WHERE session_id = ? AND role = 'user'
         ORDER BY id DESC
         LIMIT 1`
      ).get(sessionId) as { id: number } | undefined;

      if (lastUser) {
        db.prepare(
          `WITH RECURSIVE subtree(id) AS (
             SELECT id FROM messages WHERE id = ? AND session_id = ?
             UNION ALL
             SELECT m.id
             FROM messages m
             JOIN subtree s ON m.parent_id = s.id
             WHERE m.session_id = ?
           )
           DELETE FROM messages WHERE id IN (SELECT id FROM subtree)`
        ).run(lastUser.id, sessionId, sessionId);
      }

      db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), sessionId);

      return NextResponse.json({ success: true, rewindResult });
    }

    if (action === 'restore') {
      const restoreId = typeof checkpointId === 'string' && checkpointId.trim()
        ? checkpointId.trim()
        : (typeof toolId === 'string' ? toolId.trim() : '');

      if (!restoreId) {
        return NextResponse.json({ error: 'checkpointId is required for restore' }, { status: 400 });
      }

      const restoreResult = await core.restoreCheckpoint(restoreId);
      if (!restoreResult.success) {
        return NextResponse.json({ error: restoreResult.error }, { status: 400 });
      }

      const parsedMessageId = typeof messageId === 'number'
        ? messageId
        : (typeof messageId === 'string' ? Number(messageId) : NaN);

      let pruned = false;
      let deletedCount = 0;
      if (Number.isFinite(parsedMessageId) && parsedMessageId > 0) {
        const existingRoot = db
          .prepare('SELECT id FROM messages WHERE id = ? AND session_id = ?')
          .get(parsedMessageId, sessionId) as { id: number } | undefined;

        if (existingRoot) {
          const deleteTx = db.transaction(() => {
            const deleteResult = db.prepare(
              `WITH RECURSIVE subtree(id) AS (
                 SELECT id FROM messages WHERE id = ? AND session_id = ?
                 UNION ALL
                 SELECT m.id
                 FROM messages m
                 JOIN subtree s ON m.parent_id = s.id
                 WHERE m.session_id = ?
               )
               DELETE FROM messages WHERE id IN (SELECT id FROM subtree)`
            ).run(parsedMessageId, sessionId, sessionId);

            db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), sessionId);
            return deleteResult.changes;
          });

          deletedCount = deleteTx();
          pruned = deletedCount > 0;
        }
      }

      return NextResponse.json({ success: true, restoreId, restoreResult, pruned, deletedCount });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('Failed to process chat control action:', error);
    return NextResponse.json({ error: 'Failed to process chat control action' }, { status: 500 });
  }
}
