import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure the directory exists
const dbPath = path.join(process.cwd(), 'gemini-home', 'gem-ui.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

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
`);

// Migration: Add workspace column if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
  const hasWorkspace = tableInfo.some(col => col.name === 'workspace');
  const hasBranch = tableInfo.some(col => col.name === 'branch');

  if (!hasWorkspace) {
    db.exec('ALTER TABLE sessions ADD COLUMN workspace TEXT');
  }

  if (!hasBranch) {
    db.exec('ALTER TABLE sessions ADD COLUMN branch TEXT');
  }
} catch (error) {
  console.error('Failed to migrate sessions table:', error);
}

// Migration: Add parent_id column to messages if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(messages)").all() as { name: string }[];
  const hasParentId = tableInfo.some(col => col.name === 'parent_id');

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

export default db;

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
  parent_id?: number | null;
  created_at: number;
}
