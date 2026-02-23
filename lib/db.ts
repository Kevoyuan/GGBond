import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { resolveRuntimeHome } from '@/lib/runtime-home';

const LEGACY_HOME = path.join(process.cwd(), 'gemini-home');
const LEGACY_DB_PATH = path.join(LEGACY_HOME, 'ggbond.db');

function getDefaultDataHomes(): string[] {
  const home = os.homedir();
  const homes: string[] = [];

  if (process.platform === 'darwin') {
    homes.push(
      path.join(home, 'Library', 'Application Support', 'ggbond', 'gemini-home'),
      path.join(home, 'Library', 'Application Support', 'GGBond', 'gemini-home'),
      path.join(home, 'Library', 'Application Support', 'gg-bond', 'gemini-home')
    );
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    homes.push(
      path.join(appData, 'ggbond', 'gemini-home'),
      path.join(appData, 'GGBond', 'gemini-home'),
      path.join(appData, 'gg-bond', 'gemini-home')
    );
  } else {
    homes.push(
      path.join(home, '.local', 'share', 'ggbond', 'gemini-home'),
      path.join(home, '.local', 'share', 'GGBond', 'gemini-home'),
      path.join(home, '.local', 'share', 'gg-bond', 'gemini-home')
    );
  }

  homes.push(path.join(home, '.ggbond'));
  return homes;
}

function ensureWritableDirectory(dirPath: string): boolean {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveDbPath(): string {
  const runtimeHome = resolveRuntimeHome();
  const envHome = process.env.GGBOND_DATA_HOME?.trim() || process.env.GGBOND_HOME?.trim();
  const candidates = [
    runtimeHome,
    envHome,
    ...getDefaultDataHomes(),
    LEGACY_HOME,
    path.join(os.tmpdir(), 'ggbond'),
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));

  const uniqueCandidates = [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
  for (const candidate of uniqueCandidates) {
    if (ensureWritableDirectory(candidate)) {
      return path.join(candidate, 'ggbond.db');
    }
  }

  throw new Error('No writable directory available for SQLite database');
}

function migrateLegacyDbIfNeeded(targetDbPath: string) {
  if (targetDbPath === LEGACY_DB_PATH) return;
  if (!fs.existsSync(LEGACY_DB_PATH)) return;
  if (fs.existsSync(targetDbPath)) return;

  try {
    fs.copyFileSync(LEGACY_DB_PATH, targetDbPath);
    console.log(`[DB] Migrated legacy DB from ${LEGACY_DB_PATH} to ${targetDbPath}`);
  } catch (error) {
    console.warn('[DB] Failed to migrate legacy database:', error);
  }
}

function mergeSourceDbDataIfNeeded(sourceDbPath: string, targetDbPath: string, targetDb: Database.Database) {
  if (!sourceDbPath || sourceDbPath === targetDbPath) return;
  if (!fs.existsSync(sourceDbPath)) return;
  if (!fs.existsSync(targetDbPath)) return;

  let legacyDb: Database.Database | null = null;
  try {
    legacyDb = new Database(sourceDbPath, { readonly: true });

    const legacySessionColumns = (legacyDb.prepare('PRAGMA table_info(sessions)').all() as { name: string }[])
      .map((col) => col.name);
    const hasLegacyArchived = legacySessionColumns.includes('archived');
    const targetSessionColumns = (targetDb.prepare('PRAGMA table_info(sessions)').all() as { name: string }[])
      .map((col) => col.name);
    const hasTargetArchived = targetSessionColumns.includes('archived');

    const legacySessions = legacyDb.prepare(`
      SELECT id, title, created_at, updated_at, workspace, branch, ${hasLegacyArchived ? 'archived' : '0 AS archived'}
      FROM sessions
      ORDER BY updated_at DESC
    `).all() as Array<{
      id: string;
      title: string;
      created_at: number;
      updated_at: number;
      workspace: string | null;
      branch: string | null;
      archived: number;
    }>;

    if (legacySessions.length === 0) return;

    const targetSessionIds = new Set(
      (targetDb.prepare('SELECT id FROM sessions').all() as Array<{ id: string }>).map((row) => row.id)
    );
    const missingSessions = legacySessions.filter((session) => !targetSessionIds.has(session.id));
    if (missingSessions.length === 0) return;

    const legacyMessageColumns = (legacyDb.prepare('PRAGMA table_info(messages)').all() as { name: string }[])
      .map((col) => col.name);
    const targetMessageColumns = (targetDb.prepare('PRAGMA table_info(messages)').all() as { name: string }[])
      .map((col) => col.name);
    const hasLegacyThought = legacyMessageColumns.includes('thought');
    const hasLegacyCitations = legacyMessageColumns.includes('citations');
    const hasLegacyImages = legacyMessageColumns.includes('images');
    const hasLegacyParentId = legacyMessageColumns.includes('parent_id');
    const hasLegacyUpdatedAt = legacyMessageColumns.includes('updated_at');
    const hasTargetMsgUpdatedAt = targetMessageColumns.includes('updated_at');

    const insertSession = hasTargetArchived
      ? targetDb.prepare(`
          INSERT INTO sessions (id, title, created_at, updated_at, workspace, branch, archived)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
      : targetDb.prepare(`
          INSERT INTO sessions (id, title, created_at, updated_at, workspace, branch)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
    const insertMessage = hasTargetMsgUpdatedAt
      ? targetDb.prepare(`
          INSERT INTO messages (session_id, role, content, stats, thought, citations, images, parent_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
      : targetDb.prepare(`
          INSERT INTO messages (session_id, role, content, stats, thought, citations, images, parent_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

    const migrateTx = targetDb.transaction(() => {
      for (const session of missingSessions) {
        if (hasTargetArchived) {
          insertSession.run(
            session.id,
            session.title || 'New Chat',
            session.created_at || Date.now(),
            session.updated_at || Date.now(),
            session.workspace ?? null,
            session.branch ?? null,
            session.archived ? 1 : 0
          );
        } else {
          insertSession.run(
            session.id,
            session.title || 'New Chat',
            session.created_at || Date.now(),
            session.updated_at || Date.now(),
            session.workspace ?? null,
            session.branch ?? null
          );
        }

        const legacyMessages = legacyDb!.prepare(`
          SELECT
            id,
            session_id,
            role,
            content,
            stats,
            ${hasLegacyThought ? 'thought' : 'NULL AS thought'},
            ${hasLegacyCitations ? 'citations' : 'NULL AS citations'},
            ${hasLegacyImages ? 'images' : 'NULL AS images'},
            ${hasLegacyParentId ? 'parent_id' : 'NULL AS parent_id'},
            created_at,
            ${hasLegacyUpdatedAt ? 'updated_at' : 'NULL AS updated_at'}
          FROM messages
          WHERE session_id = ?
          ORDER BY id ASC
        `).all(session.id) as Array<{
          id: number;
          session_id: string;
          role: string;
          content: string;
          stats: string | null;
          thought: string | null;
          citations: string | null;
          images: string | null;
          parent_id: number | null;
          created_at: number;
          updated_at: number | null;
        }>;

        const idMap = new Map<number, number>();
        for (const msg of legacyMessages) {
          const parentMapped = msg.parent_id ? idMap.get(msg.parent_id) ?? null : null;
          const info = hasTargetMsgUpdatedAt
            ? insertMessage.run(
              session.id,
              msg.role,
              msg.content,
              msg.stats ?? null,
              msg.thought ?? null,
              msg.citations ?? null,
              msg.images ?? null,
              parentMapped,
              msg.created_at || Date.now(),
              msg.updated_at ?? msg.created_at ?? Date.now()
            )
            : insertMessage.run(
              session.id,
              msg.role,
              msg.content,
              msg.stats ?? null,
              msg.thought ?? null,
              msg.citations ?? null,
              msg.images ?? null,
              parentMapped,
              msg.created_at || Date.now()
            );
          idMap.set(msg.id, Number(info.lastInsertRowid));
        }
      }
    });

    migrateTx();
    console.log(`[DB] Merged ${missingSessions.length} legacy session(s) from ${sourceDbPath}`);
  } catch (error) {
    console.warn(`[DB] Failed to merge legacy database data from ${sourceDbPath}:`, error);
  } finally {
    try {
      legacyDb?.close();
    } catch {
      // Ignore close errors.
    }
  }
}

function mergeKnownDbDataIfNeeded(targetDbPath: string, targetDb: Database.Database) {
  const sourceDbPaths = new Set<string>();
  sourceDbPaths.add(LEGACY_DB_PATH);
  const defaultHomes = getDefaultDataHomes();
  for (const home of defaultHomes) {
    sourceDbPaths.add(path.join(home, 'ggbond.db'));
  }

  // Additional legacy locations from older desktop builds:
  // - db directly under app data root (without gemini-home)
  // - name variants used across historic app ids
  const home = os.homedir();
  if (process.platform === 'darwin') {
    const roots = [
      path.join(home, 'Library', 'Application Support', 'ggbond'),
      path.join(home, 'Library', 'Application Support', 'GGBond'),
      path.join(home, 'Library', 'Application Support', 'gg-bond'),
    ];
    for (const root of roots) {
      sourceDbPaths.add(path.join(root, 'ggbond.db'));
      sourceDbPaths.add(path.join(root, '.gemini', 'ggbond.db'));
      sourceDbPaths.add(path.join(root, 'gemini-home', 'ggbond.db'));
    }
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const roots = [
      path.join(appData, 'ggbond'),
      path.join(appData, 'GGBond'),
      path.join(appData, 'gg-bond'),
    ];
    for (const root of roots) {
      sourceDbPaths.add(path.join(root, 'ggbond.db'));
      sourceDbPaths.add(path.join(root, '.gemini', 'ggbond.db'));
      sourceDbPaths.add(path.join(root, 'gemini-home', 'ggbond.db'));
    }
  } else {
    const roots = [
      path.join(home, '.local', 'share', 'ggbond'),
      path.join(home, '.local', 'share', 'GGBond'),
      path.join(home, '.local', 'share', 'gg-bond'),
    ];
    for (const root of roots) {
      sourceDbPaths.add(path.join(root, 'ggbond.db'));
      sourceDbPaths.add(path.join(root, '.gemini', 'ggbond.db'));
      sourceDbPaths.add(path.join(root, 'gemini-home', 'ggbond.db'));
    }
  }

  for (const sourceDbPath of sourceDbPaths) {
    mergeSourceDbDataIfNeeded(sourceDbPath, targetDbPath, targetDb);
  }
}

const dbPath = resolveDbPath();
migrateLegacyDbIfNeeded(dbPath);
const db = new Database(dbPath);
try {
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
} catch (error) {
  console.warn('[DB] Failed to apply pragmas:', error);
}
console.log(`[DB] Using database: ${dbPath}`);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    workspace TEXT,
    branch TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    stats TEXT,
    thought TEXT,
    citations TEXT,
    images TEXT,
    parent_id INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES messages (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS confirmation_queue (
    correlation_id TEXT PRIMARY KEY,
    confirmed INTEGER NOT NULL,
    outcome TEXT,
    payload TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS undo_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_message_id INTEGER NOT NULL,
    restore_id TEXT,
    fallback_files TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
    FOREIGN KEY (user_message_id) REFERENCES messages (id) ON DELETE CASCADE,
    UNIQUE(session_id, user_message_id)
  );

  CREATE TABLE IF NOT EXISTS background_jobs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_message_id INTEGER,
    status TEXT NOT NULL DEFAULT 'running',
    current_content TEXT,
    current_thought TEXT,
    current_tool_calls TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    agent_display_name TEXT,
    description TEXT,
    task TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    workspace TEXT,
    model TEXT,
    result TEXT,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS tool_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_name TEXT NOT NULL,
    session_id TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS file_ops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    operation TEXT NOT NULL,
    session_id TEXT,
    workspace TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS message_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    images TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    result_message_id TEXT,
    error TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_message_queue_session ON message_queue(session_id);
  CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status);

  -- Chat snapshots for /chat save/resume functionality
  CREATE TABLE IF NOT EXISTS chat_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    title TEXT,
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
    UNIQUE(session_id, tag)
  );

  -- App configuration (geminiignore, trusted folders, custom commands)
  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

// Migration: Add workspace column if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
  const hasWorkspace = tableInfo.some(col => col.name === 'workspace');
  const hasBranch = tableInfo.some(col => col.name === 'branch');
  const hasArchived = tableInfo.some(col => col.name === 'archived');

  if (!hasWorkspace) {
    db.exec('ALTER TABLE sessions ADD COLUMN workspace TEXT');
  }

  if (!hasBranch) {
    db.exec('ALTER TABLE sessions ADD COLUMN branch TEXT');
  }

  if (!hasArchived) {
    db.exec('ALTER TABLE sessions ADD COLUMN archived INTEGER DEFAULT 0');
  }
} catch (error) {
  console.error('Failed to migrate sessions table:', error);
}

// Migration: Add parent_id column to messages if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(messages)").all() as { name: string }[];
  const hasParentId = tableInfo.some(col => col.name === 'parent_id');
  const hasThought = tableInfo.some(col => col.name === 'thought');
  const hasCitations = tableInfo.some(col => col.name === 'citations');

  if (!hasThought) {
    db.exec('ALTER TABLE messages ADD COLUMN thought TEXT');
  }

  if (!hasCitations) {
    db.exec('ALTER TABLE messages ADD COLUMN citations TEXT');
  }

  if (!hasParentId) {
    console.log('Migrating messages table: Adding parent_id...');
    db.exec('ALTER TABLE messages ADD COLUMN parent_id INTEGER REFERENCES messages(id) ON DELETE CASCADE');

    // Backfill parent_id for existing messages (assuming linear history)
    const sessions = db.prepare('SELECT id FROM sessions').all() as { id: string }[];

    const updateStmt = db.prepare('UPDATE messages SET parent_id = ? WHERE id = ?');

    for (const session of sessions) {
      const messages = db.prepare('SELECT id FROM messages WHERE session_id = ? ORDER BY id ASC').all(session.id) as { id: number }[];

      for (let i = 1; i < messages.length; i++) {
        const currentMsg = messages[i];
        const parentMsg = messages[i - 1];
        updateStmt.run(parentMsg.id, currentMsg.id);
      }
    }
    console.log('Migration complete: parent_id added and backfilled.');
  }
} catch (error) {
  console.error('Failed to migrate messages table:', error);
}

// Migration: Add updated_at column to messages if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(messages)").all() as { name: string }[];
  const hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at');

  if (!hasUpdatedAt) {
    db.exec('ALTER TABLE messages ADD COLUMN updated_at INTEGER');
    console.log('Migration complete: updated_at column added to messages.');
  }
} catch (error) {
  console.error('Failed to add updated_at column to messages:', error);
}

// Migration: merge data from legacy project-local DB when switching to user-level runtime home.
try {
  mergeKnownDbDataIfNeeded(dbPath, db);
} catch (error) {
  console.error('Failed to merge known legacy DB data:', error);
}

// Migration: Add error column to background_jobs if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(background_jobs)").all() as { name: string }[];
  const hasError = tableInfo.some(col => col.name === 'error');

  if (!hasError) {
    db.exec('ALTER TABLE background_jobs ADD COLUMN error TEXT');
    console.log('Migration complete: error column added to background_jobs.');
  }
} catch (error) {
  console.error('Failed to add error column to background_jobs:', error);
}

export default db;

// Message Queue Operations
export interface QueueMessage {
  id: number;
  session_id: string;
  content: string;
  images?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  created_at: number;
  started_at?: number | null;
  completed_at?: number | null;
  result_message_id?: string | null;
  error?: string | null;
}

export const queueMessage = {
  add: (sessionId: string, content: string, images?: string[], priority: number = 0) => {
    const stmt = db.prepare(`
      INSERT INTO message_queue (session_id, content, images, priority, created_at, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    const result = stmt.run(sessionId, content, images ? JSON.stringify(images) : null, priority, Date.now());
    return result.lastInsertRowid;
  },

  getBySession: (sessionId: string) => {
    const stmt = db.prepare(`
      SELECT * FROM message_queue
      WHERE session_id = ?
      ORDER BY priority DESC, created_at ASC
    `);
    return stmt.all(sessionId) as QueueMessage[];
  },

  getPending: (sessionId: string) => {
    const stmt = db.prepare(`
      SELECT * FROM message_queue
      WHERE session_id = ? AND status = 'pending'
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `);
    return stmt.get(sessionId) as QueueMessage | undefined;
  },

  getById: (id: number) => {
    const stmt = db.prepare('SELECT * FROM message_queue WHERE id = ?');
    return stmt.get(id) as QueueMessage | undefined;
  },

  updateStatus: (id: number, status: string, resultMessageId?: string, error?: string) => {
    const stmt = db.prepare(`
      UPDATE message_queue
      SET status = ?,
          started_at = COALESCE(started_at, CASE WHEN ? = 'processing' THEN ? ELSE NULL END),
          completed_at = CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN ? ELSE completed_at END,
          result_message_id = COALESCE(?, result_message_id),
          error = COALESCE(?, error)
      WHERE id = ?
    `);
    return stmt.run(status, status, Date.now(), status, Date.now(), resultMessageId || null, error || null, id);
  },

  cancel: (id: number) => {
    const stmt = db.prepare(`
      UPDATE message_queue
      SET status = 'cancelled', completed_at = ?
      WHERE id = ? AND status IN ('pending', 'processing')
    `);
    return stmt.run(Date.now(), id);
  },

  clear: (sessionId: string, status?: string) => {
    if (status) {
      const stmt = db.prepare('DELETE FROM message_queue WHERE session_id = ? AND status = ?');
      return stmt.run(sessionId, status);
    }
    const stmt = db.prepare('DELETE FROM message_queue WHERE session_id = ?');
    return stmt.run(sessionId);
  },

  getStats: (sessionId: string) => {
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM message_queue
      WHERE session_id = ?
    `);
    return stmt.get(sessionId) as {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      cancelled: number;
    };
  }
};

export interface Session {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  workspace?: string;
  branch?: string | null;
}

export interface DbMessage {
  id: number;
  session_id: string;
  role: 'user' | 'model';
  content: string;
  stats?: string; // JSON string
  thought?: string | null;
  citations?: string | null; // JSON string
  parent_id?: number | null;
  created_at: number;
}

// Chat Snapshots Operations (for /chat save/resume)
export interface ChatSnapshot {
  id: number;
  session_id: string;
  tag: string;
  title?: string | null;
  message_count: number;
  created_at: number;
}

export const chatSnapshots = {
  // Save a snapshot of the current session
  save: (sessionId: string, tag: string, title?: string, messageCount?: number) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO chat_snapshots (session_id, tag, title, message_count, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(
      sessionId,
      tag,
      title || null,
      messageCount || 0,
      Date.now()
    );
  },

  // List all snapshots for a session
  list: (sessionId?: string) => {
    if (sessionId) {
      const stmt = db.prepare(`
        SELECT cs.*, s.title as session_title
        FROM chat_snapshots cs
        JOIN sessions s ON cs.session_id = s.id
        WHERE cs.session_id = ?
        ORDER BY cs.created_at DESC
      `);
      return stmt.all(sessionId) as (ChatSnapshot & { session_title: string })[];
    }
    const stmt = db.prepare(`
      SELECT cs.*, s.title as session_title
      FROM chat_snapshots cs
      JOIN sessions s ON cs.session_id = s.id
      ORDER BY cs.created_at DESC
    `);
    return stmt.all() as (ChatSnapshot & { session_title: string })[];
  },

  // Get a specific snapshot by tag
  get: (sessionId: string, tag: string) => {
    const stmt = db.prepare(`
      SELECT cs.*, s.title as session_title
      FROM chat_snapshots cs
      JOIN sessions s ON cs.session_id = s.id
      WHERE cs.session_id = ? AND cs.tag = ?
    `);
    return stmt.get(sessionId, tag) as (ChatSnapshot & { session_title: string }) | undefined;
  },

  // Delete a snapshot
  delete: (sessionId: string, tag: string) => {
    const stmt = db.prepare(`
      DELETE FROM chat_snapshots WHERE session_id = ? AND tag = ?
    `);
    return stmt.run(sessionId, tag);
  },

  // Delete all snapshots for a session
  deleteAll: (sessionId: string) => {
    const stmt = db.prepare('DELETE FROM chat_snapshots WHERE session_id = ?');
    return stmt.run(sessionId);
  }
};
