import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'gemini-home', 'gem-ui.db');

// Ensure directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    role TEXT,
    content TEXT,
    stats TEXT,
    created_at INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
  );
`);

export interface Session {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id?: number;
  session_id: string;
  role: 'user' | 'model';
  content: string;
  stats?: string; // JSON string
  created_at: number;
}

export const getSessions = () => {
  return db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as Session[];
};

export const getSession = (id: string) => {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
};

export const createSession = (id: string, title: string) => {
  const now = Date.now();
  db.prepare('INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, title, now, now);
  return { id, title, created_at: now, updated_at: now };
};

export const updateSessionTimestamp = (id: string) => {
  const now = Date.now();
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, id);
};

export const deleteSession = (id: string) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
};

export const getMessages = (sessionId: string) => {
  const msgs = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as Message[];
  return msgs.map(m => ({
    ...m,
    stats: m.stats ? JSON.parse(m.stats) : undefined
  }));
};

export const addMessage = (sessionId: string, role: 'user' | 'model', content: string, stats?: any) => {
  const now = Date.now();
  db.prepare('INSERT INTO messages (session_id, role, content, stats, created_at) VALUES (?, ?, ?, ?, ?)').run(
    sessionId, 
    role, 
    content, 
    stats ? JSON.stringify(stats) : null, 
    now
  );
  updateSessionTimestamp(sessionId);
};

export default db;
