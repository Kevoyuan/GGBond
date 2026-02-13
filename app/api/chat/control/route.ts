import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { CoreService } from '@/lib/core-service';
import path from 'path';
import {
  applyFallbackUndoFiles,
  buildUndoPreview,
  parseFallbackFiles,
  parseMessageId,
  pruneMessageSubtree,
} from './undo-utils';

type UndoSnapshotRow = {
  restore_id?: string | null;
  fallback_files?: string | null;
};

function resolveWorkspaceRoot(workspace: unknown) {
  return path.resolve((typeof workspace === 'string' && workspace !== 'Default') ? workspace : process.cwd());
}

function getUndoSnapshotForUserMessage(sessionId: string, messageId: number) {
  const targetMessage = db.prepare(
    `SELECT id, role
     FROM messages
     WHERE id = ? AND session_id = ?`
  ).get(messageId, sessionId) as { id: number; role: string } | undefined;

  if (!targetMessage || targetMessage.role !== 'user') {
    return { snapshot: null, error: 'Target message must be an existing user message' as const };
  }

  const snapshot = db.prepare(
    `SELECT restore_id, fallback_files
     FROM undo_snapshots
     WHERE session_id = ? AND user_message_id = ?`
  ).get(sessionId, messageId) as UndoSnapshotRow | undefined;

  if (!snapshot) {
    return { snapshot: null, error: 'No undo snapshot is available for this message. Please use a newer message.' as const };
  }

  return { snapshot, error: null };
}

export async function POST(req: Request) {
  try {
    const { action, sessionId, toolId, checkpointId, messageId, workspace, model } = await req.json();

    if (!action || !sessionId) {
      return NextResponse.json({ error: 'action and sessionId are required' }, { status: 400 });
    }

    const resolvedModel = model || 'gemini-2.5-pro';
    const resolvedCwd = (workspace && workspace !== 'Default') ? workspace : process.cwd();
    let core: CoreService | null = null;
    const ensureCoreInitialized = async () => {
      if (core) return core;
      core = CoreService.getInstance();
      await core.initialize({
        sessionId,
        model: resolvedModel,
        cwd: resolvedCwd,
        approvalMode: 'default'
      });
      return core;
    };

    if (action === 'rewind') {
      const coreInstance = await ensureCoreInitialized();
      const rewindResult = coreInstance.rewindLastUserMessage();
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
        pruneMessageSubtree(sessionId, lastUser.id);
      } else {
        db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), sessionId);
      }

      return NextResponse.json({ success: true, rewindResult });
    }

    if (action === 'restore') {
      const coreInstance = await ensureCoreInitialized();
      const restoreId = typeof checkpointId === 'string' && checkpointId.trim()
        ? checkpointId.trim()
        : (typeof toolId === 'string' ? toolId.trim() : '');

      if (!restoreId) {
        return NextResponse.json({ error: 'checkpointId is required for restore' }, { status: 400 });
      }

      const restoreResult = await coreInstance.restoreCheckpoint(restoreId);
      if (!restoreResult.success) {
        return NextResponse.json({ error: restoreResult.error }, { status: 400 });
      }

      const parsedMessageId = parseMessageId(messageId);

      let pruned = false;
      let deletedCount = 0;
      if (parsedMessageId) {
        const existingRoot = db
          .prepare('SELECT id FROM messages WHERE id = ? AND session_id = ?')
          .get(parsedMessageId, sessionId) as { id: number } | undefined;

        if (existingRoot) {
          const prunedResult = pruneMessageSubtree(sessionId, parsedMessageId);
          deletedCount = prunedResult.deletedMessages;
          pruned = deletedCount > 0;
        }
      }

      return NextResponse.json({ success: true, restoreId, restoreResult, pruned, deletedCount });
    }

    if (action === 'undo_message') {
      const targetMessageId = parseMessageId(messageId);
      if (!targetMessageId) {
        return NextResponse.json({ error: 'messageId is required for undo_message' }, { status: 400 });
      }

      const { snapshot, error } = getUndoSnapshotForUserMessage(sessionId, targetMessageId);
      if (!snapshot) {
        return NextResponse.json({ error }, { status: 400 });
      }

      const fallbackFiles = parseFallbackFiles(snapshot.fallback_files);
      const shouldRestoreByCheckpoint = Boolean(snapshot.restore_id && fallbackFiles.length === 0);

      let restoreResult: unknown = null;
      let restoredByCheckpoint = false;
      if (shouldRestoreByCheckpoint && snapshot.restore_id) {
        const coreInstance = await ensureCoreInitialized();
        const result = await coreInstance.restoreCheckpoint(snapshot.restore_id);
        if (!result.success) {
          return NextResponse.json({ error: result.error || 'Checkpoint restore failed' }, { status: 400 });
        }
        restoreResult = result;
        restoredByCheckpoint = true;
      }

      const workspaceRoot = resolveWorkspaceRoot(workspace);
      const fallbackRestoredCount = await applyFallbackUndoFiles(fallbackFiles, workspaceRoot);

      const prunedResult = pruneMessageSubtree(sessionId, targetMessageId);

      return NextResponse.json({
        success: true,
        action: 'undo_message',
        restoredByCheckpoint,
        restoreResult,
        fallbackRestoredCount,
        deletedCount: prunedResult.deletedMessages,
        deletedSnapshots: prunedResult.deletedSnapshots,
      });
    }

    if (action === 'undo_message_preview') {
      const targetMessageId = parseMessageId(messageId);
      if (!targetMessageId) {
        return NextResponse.json({ error: 'messageId is required for undo_message_preview' }, { status: 400 });
      }

      const { snapshot, error } = getUndoSnapshotForUserMessage(sessionId, targetMessageId);
      if (!snapshot) {
        return NextResponse.json({ error }, { status: 400 });
      }

      const fallbackFiles = parseFallbackFiles(snapshot.fallback_files);
      const workspaceRoot = resolveWorkspaceRoot(workspace);
      const fileChanges = await buildUndoPreview(fallbackFiles, workspaceRoot);

      return NextResponse.json({
        success: true,
        action: 'undo_message_preview',
        messageId: targetMessageId,
        hasCheckpoint: Boolean(snapshot.restore_id),
        fallbackScoped: true,
        fileChanges,
      });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('Failed to process chat control action:', error);
    return NextResponse.json({ error: 'Failed to process chat control action' }, { status: 500 });
  }
}
