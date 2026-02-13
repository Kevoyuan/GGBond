import db from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export type FileUndoFallbackEntry = {
  path: string;
  existedBefore: boolean;
  originalContentBase64?: string;
};

export type UndoPreviewFileChange = {
  path: string;
  displayPath: string;
  status: 'modified' | 'created' | 'deleted';
  addedLines: number;
  removedLines: number;
};

export function parseMessageId(rawMessageId: unknown) {
  const parsed = typeof rawMessageId === 'number'
    ? rawMessageId
    : (typeof rawMessageId === 'string' ? Number(rawMessageId) : NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isSameOrChildPath(candidatePath: string, parentPath: string) {
  const candidate = path.resolve(candidatePath);
  const parent = path.resolve(parentPath);
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

export function parseFallbackFiles(rawFallbackFiles: string | null | undefined) {
  if (!rawFallbackFiles) return [];

  try {
    const parsed = JSON.parse(rawFallbackFiles);
    if (Array.isArray(parsed)) {
      return parsed as FileUndoFallbackEntry[];
    }
    return [];
  } catch {
    return [];
  }
}

function splitLines(text: string) {
  if (!text) return [];
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (normalized.endsWith('\n') && lines.length > 0) {
    lines.pop();
  }
  return lines;
}

function countCommonPrefixLines(before: string[], after: string[]) {
  const maxShared = Math.min(before.length, after.length);
  let shared = 0;

  while (shared < maxShared && before[shared] === after[shared]) {
    shared += 1;
  }

  return shared;
}

function countCommonSuffixLines(before: string[], after: string[], prefixCount: number) {
  const beforeLimit = before.length - prefixCount;
  const afterLimit = after.length - prefixCount;
  const maxShared = Math.min(beforeLimit, afterLimit);
  let shared = 0;

  while (shared < maxShared && before[before.length - 1 - shared] === after[after.length - 1 - shared]) {
    shared += 1;
  }

  return shared;
}

function getLcsLength(before: string[], after: string[]) {
  let rows = before;
  let columns = after;

  if (rows.length < columns.length) {
    [rows, columns] = [columns, rows];
  }

  let previous = new Array(columns.length + 1).fill(0);
  let current = new Array(columns.length + 1).fill(0);

  for (let i = 1; i <= rows.length; i += 1) {
    const rowValue = rows[i - 1];
    for (let j = 1; j <= columns.length; j += 1) {
      if (rowValue === columns[j - 1]) {
        current[j] = previous[j - 1] + 1;
      } else {
        current[j] = Math.max(previous[j], current[j - 1]);
      }
    }
    [previous, current] = [current, previous];
    current.fill(0);
  }

  return previous[columns.length];
}

function computeLineChangeCounts(beforeText: string, afterText: string) {
  if (beforeText === afterText) {
    return {
      addedLines: 0,
      removedLines: 0,
    };
  }

  const before = splitLines(beforeText);
  const after = splitLines(afterText);
  const beforeLen = before.length;
  const afterLen = after.length;

  if (beforeLen === 0 || afterLen === 0) {
    return {
      addedLines: afterLen,
      removedLines: beforeLen,
    };
  }

  const sharedPrefix = countCommonPrefixLines(before, after);
  const sharedSuffix = countCommonSuffixLines(before, after, sharedPrefix);
  const beforeTrimmed = before.slice(sharedPrefix, beforeLen - sharedSuffix);
  const afterTrimmed = after.slice(sharedPrefix, afterLen - sharedSuffix);
  const beforeTrimmedLen = beforeTrimmed.length;
  const afterTrimmedLen = afterTrimmed.length;

  if (beforeTrimmedLen === 0 || afterTrimmedLen === 0) {
    return {
      addedLines: afterTrimmedLen,
      removedLines: beforeTrimmedLen,
    };
  }

  // Keep preview calculation fast for very large files.
  if (beforeTrimmedLen * afterTrimmedLen > 250_000) {
    const sharedApprox = Math.min(beforeTrimmedLen, afterTrimmedLen);
    return {
      addedLines: Math.max(0, afterTrimmedLen - sharedApprox),
      removedLines: Math.max(0, beforeTrimmedLen - sharedApprox),
    };
  }

  const shared = getLcsLength(beforeTrimmed, afterTrimmed);
  return {
    addedLines: Math.max(0, afterTrimmedLen - shared),
    removedLines: Math.max(0, beforeTrimmedLen - shared),
  };
}

export async function buildUndoPreview(entries: FileUndoFallbackEntry[], workspaceRoot: string) {
  const changes = await Promise.all(entries.map(async (entry) => {
    if (!entry || typeof entry.path !== 'string' || typeof entry.existedBefore !== 'boolean') {
      return null;
    }

    const targetPath = path.isAbsolute(entry.path)
      ? path.resolve(entry.path)
      : path.resolve(workspaceRoot, entry.path);
    if (!isSameOrChildPath(targetPath, workspaceRoot)) {
      return null;
    }

    const relativePath = path.relative(workspaceRoot, targetPath);
    const displayPath = (relativePath || path.basename(targetPath)).split(path.sep).join('/');

    if (!entry.existedBefore) {
      let currentContent = '';
      try {
        currentContent = await fs.readFile(targetPath, 'utf8');
      } catch {
        currentContent = '';
      }

      return {
        path: targetPath,
        displayPath,
        status: 'deleted',
        addedLines: 0,
        removedLines: splitLines(currentContent).length,
      };
    }

    if (typeof entry.originalContentBase64 !== 'string') {
      return null;
    }

    const originalContent = Buffer.from(entry.originalContentBase64, 'base64').toString('utf8');
    let currentContent = '';
    let existsNow = true;
    try {
      currentContent = await fs.readFile(targetPath, 'utf8');
    } catch {
      existsNow = false;
      currentContent = '';
    }

    const { addedLines, removedLines } = computeLineChangeCounts(currentContent, originalContent);
    return {
      path: targetPath,
      displayPath,
      status: existsNow ? 'modified' : 'created',
      addedLines,
      removedLines,
    };
  }));

  return changes.filter((change): change is UndoPreviewFileChange => Boolean(change));
}

export async function applyFallbackUndoFiles(entries: FileUndoFallbackEntry[], workspaceRoot: string) {
  let restoredCount = 0;

  for (const entry of entries) {
    if (!entry || typeof entry.path !== 'string' || typeof entry.existedBefore !== 'boolean') {
      continue;
    }

    const targetPath = path.isAbsolute(entry.path)
      ? path.resolve(entry.path)
      : path.resolve(workspaceRoot, entry.path);
    if (!isSameOrChildPath(targetPath, workspaceRoot)) {
      continue;
    }

    if (entry.existedBefore) {
      if (typeof entry.originalContentBase64 !== 'string') {
        continue;
      }
      const content = Buffer.from(entry.originalContentBase64, 'base64');
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content);
      restoredCount += 1;
      continue;
    }

    await fs.rm(targetPath, { force: true });
    restoredCount += 1;
  }

  return restoredCount;
}

export function pruneMessageSubtree(sessionId: string, rootMessageId: number) {
  const tx = db.transaction(() => {
    const subtreeRows = db.prepare(
      `WITH RECURSIVE subtree(id) AS (
         SELECT id FROM messages WHERE id = ? AND session_id = ?
         UNION ALL
         SELECT m.id
         FROM messages m
         JOIN subtree s ON m.parent_id = s.id
         WHERE m.session_id = ?
       )
       SELECT id FROM subtree`
    ).all(rootMessageId, sessionId, sessionId) as Array<{ id: number }>;

    if (subtreeRows.length === 0) {
      return {
        deletedMessages: 0,
        deletedSnapshots: 0,
      };
    }

    const subtreeIds = subtreeRows.map((row) => row.id);
    const placeholders = subtreeIds.map(() => '?').join(', ');
    const deleteMessagesResult = db.prepare(
      `DELETE FROM messages WHERE session_id = ? AND id IN (${placeholders})`
    ).run(sessionId, ...subtreeIds);

    const deleteUndoSnapshotsResult = db.prepare(
      `DELETE FROM undo_snapshots WHERE session_id = ? AND user_message_id IN (${placeholders})`
    ).run(sessionId, ...subtreeIds);

    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), sessionId);

    return {
      deletedMessages: deleteMessagesResult.changes,
      deletedSnapshots: deleteUndoSnapshotsResult.changes,
    };
  });

  return tx();
}
