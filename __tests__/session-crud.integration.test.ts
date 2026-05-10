// @vitest-environment node
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let tmpDir: string;
let testDb: Database.Database;

// Mock db module before importing session-crud
vi.mock('@/lib/db', () => ({
  default: testDb,
}));

// Dynamic import after mock is set up
let sessionCrud: typeof import('@/lib/session-crud');

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ggbond-test-'));
  testDb = new Database(join(tmpDir, 'test.db'));

  // Create schema matching lib/db.ts
  testDb.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      workspace TEXT,
      branch TEXT,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE messages (
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
      updated_at INTEGER,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);

  sessionCrud = await import('@/lib/session-crud');
});

afterAll(() => {
  testDb?.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('session-crud integration (real SQLite)', () => {
  it('createSession → listSessions round-trip', () => {
    const created = sessionCrud.createSession('/test/workspace', 'Test Session');
    expect(created).not.toHaveProperty('error');
    if ('error' in created) return; // type guard

    expect(created.title).toBe('Test Session');
    expect(created.workspace).toBe('/test/workspace');

    const sessions = sessionCrud.listSessions() as any[];
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const found = sessions.find((s: any) => s.id === created.id);
    expect(found).toBeDefined();
    expect(found.title).toBe('Test Session');
  });

  it('getSession returns session with messages', () => {
    const created = sessionCrud.createSession('/test/ws', 'With Messages');
    if ('error' in created) return;

    // Insert a message directly
    testDb.prepare(`
      INSERT INTO messages (session_id, role, content, stats, citations, images, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(created.id, 'user', 'Hello', '{"tokens": 10}', '["cite1"]', '["img1.png"]', Date.now());

    const result = sessionCrud.getSession(created.id);
    expect(result).not.toHaveProperty('error');
    if ('error' in result) return;

    expect((result.session as { id: string }).id).toBe(created.id);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe('Hello');
    expect(result.messages[0].stats).toEqual({ tokens: 10 });
    expect(result.messages[0].citations).toEqual(['cite1']);
    expect(result.messages[0].images).toEqual(['img1.png']);
  });

  it('getSession parses citations/images as arrays only', () => {
    const created = sessionCrud.createSession('/test/ws', 'Array Validation');
    if ('error' in created) return;

    // Insert message with JSON object (not array) in citations
    testDb.prepare(`
      INSERT INTO messages (session_id, role, content, citations, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(created.id, 'assistant', 'reply', '{"url":"http://example.com"}', Date.now());

    const result = sessionCrud.getSession(created.id);
    if ('error' in result) return;

    // Should be undefined because citations is not an array
    expect(result.messages[0].citations).toBeUndefined();
  });

  it('deleteSession removes session and cascades messages', () => {
    const created = sessionCrud.createSession('/test/ws', 'To Delete');
    if ('error' in created) return;

    testDb.prepare(`
      INSERT INTO messages (session_id, role, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(created.id, 'user', 'msg', Date.now());

    sessionCrud.deleteSession(created.id);

    const result = sessionCrud.getSession(created.id);
    expect(result).toHaveProperty('error', 'Session not found');
  });

  it('archiveSession toggles archived flag', () => {
    const created = sessionCrud.createSession('/test/ws', 'To Archive');
    if ('error' in created) return;

    const archived = sessionCrud.archiveSession(created.id, true);
    expect(archived).toHaveProperty('success', true);

    // Verify in DB
    const row = testDb.prepare('SELECT archived FROM sessions WHERE id = ?').get(created.id) as any;
    expect(row.archived).toBe(1);

    const unarchived = sessionCrud.archiveSession(created.id, false);
    expect(unarchived).toHaveProperty('success', true);

    const row2 = testDb.prepare('SELECT archived FROM sessions WHERE id = ?').get(created.id) as any;
    expect(row2.archived).toBe(0);
  });

  it('archiveSession returns 404 for non-existent session', () => {
    const result = sessionCrud.archiveSession('nonexistent', true);
    expect(result).toHaveProperty('error', 'Session not found');
    expect(result).toHaveProperty('status', 404);
  });

  it('updateSessionBranch sets branch', () => {
    const created = sessionCrud.createSession('/test/ws', 'Branch Test');
    if ('error' in created) return;

    const result = sessionCrud.updateSessionBranch(created.id, 'feature/test');
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('branch', 'feature/test');

    const row = testDb.prepare('SELECT branch FROM sessions WHERE id = ?').get(created.id) as any;
    expect(row.branch).toBe('feature/test');
  });

  it('updateSessionBranch returns 404 for non-existent session', () => {
    const result = sessionCrud.updateSessionBranch('nonexistent', 'main');
    expect(result).toHaveProperty('error', 'Session not found');
    expect(result).toHaveProperty('status', 404);
  });

  it('listSessions excludes empty-workspace sessions', () => {
    // Insert a session with empty workspace directly
    testDb.prepare(`
      INSERT INTO sessions (id, title, created_at, updated_at, workspace)
      VALUES (?, ?, ?, ?, ?)
    `).run('empty-ws', 'Empty', Date.now(), Date.now(), '');

    const sessions = sessionCrud.listSessions() as any[];
    const found = sessions.find((s: any) => s.id === 'empty-ws');
    expect(found).toBeUndefined();
  });

  it('createSession trims workspace and title', () => {
    const result = sessionCrud.createSession('  /test/ws  ', '  Trimmed Title  ');
    if ('error' in result) return;

    expect(result.workspace).toBe('/test/ws');
    expect(result.title).toBe('Trimmed Title');
  });
});
