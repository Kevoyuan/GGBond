import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

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

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at INTEGER NOT NULL
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

// Seed default user if not exists
try {
  const userCount = (db.prepare('SELECT count(*) as count FROM users').get() as { count: number }).count;

  if (userCount === 0) {
    const salt = randomBytes(16).toString('hex');
    // Default password: "admin"
    const hash = pbkdf2Sync('admin', salt, 1000, 64, 'sha512').toString('hex');

    db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'default-admin',
      'admin',
      hash,
      salt,
      Date.now()
    );
    console.log('Default admin user created with password "admin".');
  }
} catch (error) {
  console.error('Failed to seed default user:', error);
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

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  created_at: number;
}
