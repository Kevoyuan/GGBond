import db from './db';

export function parseJsonColumn(value: unknown, fallback: unknown = undefined) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function parseJsonArray(value: unknown): unknown[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return undefined;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function listSessions() {
  return db.prepare(`
    SELECT
      s.*,
      COUNT(m.id) AS message_count
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    WHERE s.workspace IS NOT NULL AND trim(s.workspace) <> ''
    GROUP BY s.id
    ORDER BY s.updated_at DESC
  `).all();
}

export function createSession(workspace: string, title?: string) {
  const trimmedWorkspace = workspace.trim();
  if (!trimmedWorkspace) {
    return { error: 'workspace is required', status: 400 };
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const sessionTitle = title?.trim() || 'New Chat';

  db.prepare(`
    INSERT INTO sessions (id, title, created_at, updated_at, workspace, branch)
    VALUES (?, ?, ?, ?, ?, NULL)
  `).run(id, sessionTitle, now, now, trimmedWorkspace);

  return { id, title: sessionTitle, created_at: now, updated_at: now, workspace: trimmedWorkspace, branch: null };
}

export function getSession(id: string) {
  const session = db
    .prepare("SELECT * FROM sessions WHERE id = ? AND workspace IS NOT NULL AND trim(workspace) <> ''")
    .get(id);

  if (!session) {
    return { error: 'Session not found', status: 404 };
  }

  const messages = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC').all(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsedMessages = messages.map((msg: any) => ({
    ...msg,
    stats: parseJsonColumn(msg.stats),
    thought: typeof msg.thought === 'string' ? msg.thought : undefined,
    citations: parseJsonArray(msg.citations),
    images: parseJsonArray(msg.images),
    parent_id: msg.parent_id,
    parentId: msg.parent_id === null || msg.parent_id === undefined ? null : String(msg.parent_id),
    id: msg.id === null || msg.id === undefined ? undefined : String(msg.id),
  }));

  return { session, messages: parsedMessages };
}

export function deleteSession(id: string) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
  return { success: true };
}

export function archiveSession(id: string, archived: boolean) {
  if (typeof archived !== 'boolean') {
    return { error: 'Invalid archived value', status: 400 };
  }

  const result = db.prepare('UPDATE sessions SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id);
  if (result.changes === 0) {
    return { error: 'Session not found', status: 404 };
  }
  return { success: true, archived };
}

export function updateSessionBranch(id: string, branch: string | null) {
  const result = db
    .prepare('UPDATE sessions SET branch = ?, updated_at = ? WHERE id = ?')
    .run(branch, Date.now(), id);

  if (result.changes === 0) {
    return { error: 'Session not found', status: 404 };
  }

  return { success: true, branch };
}

export function getLatestStats() {
  return { totalTokens: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, cost: 0, count: 0 };
}
