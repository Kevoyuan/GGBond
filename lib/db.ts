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
    workspace TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    stats TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
  );
`);

// Migration: Add workspace column if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
  const hasWorkspace = tableInfo.some(col => col.name === 'workspace');
  
  if (!hasWorkspace) {
    db.exec('ALTER TABLE sessions ADD COLUMN workspace TEXT');
  }
} catch (error) {
  console.error('Failed to migrate sessions table:', error);
}

export default db;

export interface Session {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  workspace?: string;
}

export interface DbMessage {
  id: number;
  session_id: string;
  role: 'user' | 'model';
  content: string;
  stats?: string; // JSON string
  created_at: number;
}
